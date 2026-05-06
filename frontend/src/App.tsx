import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ModelSelector from './components/ModelSelector';
import ThemeToggle from './components/ThemeToggle';
import KnowledgePanel from './components/KnowledgePanel';
import { Conversation, Message, OllamaModel, Attachment, Reference } from './types';
import {
  fetchConversations,
  createConversation,
  fetchConversation,
  deleteConversation,
  updateConversation,
  fetchModels,
  streamChat,
  uploadAttachment,
  fetchAttachments,
  deleteAttachment,
} from './api';
import './App.css';

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('gemma4:26b');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvIdRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    loadConversations();
    loadModels();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (activeConvId) {
      loadAttachments(activeConvId);
    } else {
      setAttachments([]);
    }
  }, [activeConvId]);

  const loadConversations = async () => {
    const data = await fetchConversations();
    setConversations(data);
  };

  const loadModels = async () => {
    try {
      const data = await fetchModels();
      setModels(data);
      if (data.length > 0 && !data.find((m: OllamaModel) => m.name === selectedModel)) {
        setSelectedModel(data[0].name);
      }
    } catch {}
  };

  const loadAttachments = async (convId: number) => {
    try {
      const data = await fetchAttachments(convId);
      setAttachments(data);
    } catch {
      setAttachments([]);
    }
  };

  const handleSelectConversation = useCallback(async (id: number) => {
    if (streaming) return;
    setActiveConvId(id);
    setMessages([]);
    setStreamingContent('');
    setThinkingContent('');
    const data = await fetchConversation(id);
    if (activeConvIdRef.current === id) {
      setMessages(data.messages || []);
      setSelectedModel(data.model);
    }
  }, [streaming]);

  const handleCreateConversation = async () => {
    if (streaming) return;
    const conv = await createConversation('새 대화', selectedModel);
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
    setMessages([]);
    setStreamingContent('');
    setThinkingContent('');
    setAttachments([]);
  };

  const handleDeleteConversation = async (id: number) => {
    if (streaming) return;
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
      setAttachments([]);
    }
  };

  const handleRenameConversation = async (id: number, title: string) => {
    await updateConversation(id, { title });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    if (activeConvId) {
      await updateConversation(activeConvId, { model });
    }
  };

  const handleFileUpload = async (file: File) => {
    let convId: number;
    if (!activeConvId) {
      const conv = await createConversation('새 대화', selectedModel);
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      convId = conv.id;
    } else {
      convId = activeConvId;
    }
    const att = await uploadAttachment(convId, file);
    setAttachments((prev) => [...prev, att]);
  };

  const handleFileRemove = async (attachmentId: number) => {
    if (!activeConvId) return;
    await deleteAttachment(activeConvId, attachmentId);
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreamingContent((prev) => {
      if (prev) {
        const assistantMsg: Message = {
          id: Date.now() + 1,
          conversation_id: activeConvId || 0,
          role: 'assistant',
          content: prev + '\n\n*(응답이 중단되었습니다)*',
          created_at: new Date().toISOString(),
        };
        setMessages((msgs) => [...msgs, assistantMsg]);
      }
      return '';
    });
    setStreaming(false);
    setThinkingContent('');
  };

  const handleSend = async (message: string) => {
    if (!activeConvId) {
      const conv = await createConversation('새 대화', selectedModel);
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      sendMessage(conv.id, message);
    } else {
      sendMessage(activeConvId, message);
    }
  };

  const sendMessage = (convId: number, message: string) => {
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: convId,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.conversation_id === convId);
      return [...filtered, userMsg];
    });
    setStreaming(true);
    setStreamingContent('');
    setThinkingContent('');

    const controller = streamChat(
      convId,
      message,
      (token) => {
        if (activeConvIdRef.current !== convId) return;
        setStreamingContent((prev) => prev + token);
      },
      (title, references) => {
        setStreamingContent((prev) => {
          if (prev) {
            const assistantMsg: Message = {
              id: Date.now() + 1,
              conversation_id: convId,
              role: 'assistant',
              content: prev,
              created_at: new Date().toISOString(),
              references,
            };
            setMessages((msgs) => [...msgs, assistantMsg]);
          }
          return '';
        });
        setStreaming(false);
        setThinkingContent('');
        abortRef.current = null;
        if (title) {
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title } : c))
          );
        }
      },
      (err) => {
        setStreamingContent('');
        setThinkingContent('');
        setStreaming(false);
        abortRef.current = null;
        if (err !== 'AbortError') {
          alert(`오류: ${err}`);
        }
      },
      (thinking) => {
        if (activeConvIdRef.current !== convId) return;
        setThinkingContent((prev) => prev + thinking);
      }
    );
    abortRef.current = controller;
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConversation}
        onCreate={handleCreateConversation}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
      />
      <main className="main">
        <header className="header">
          <ModelSelector models={models} selectedModel={selectedModel} onChange={handleModelChange} />
          <div className="header-actions">
            <button className="knowledge-btn" onClick={() => setKnowledgeOpen(true)} title="지식 저장소">
              <img src="/document_icon.svg" alt="" className="btn-icon" /> 지식 저장소
            </button>
            <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
          </div>
        </header>
        <div className="messages">
          {messages.length === 0 && !streaming && (
            <div className="empty-state">
              <h2>대화를 시작하세요</h2>
              <p>메시지를 입력하면 AI가 답변합니다.</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} references={msg.references} />
          ))}
          {streaming && !streamingContent && thinkingContent && (
            <div className="message assistant">
              <div className="message-avatar">
                <img src="/ai_icon.svg" alt="AI" className="avatar-icon" />
              </div>
              <div className="message-content thinking-indicator">
                <span className="thinking-label">생각 중...</span>
              </div>
            </div>
          )}
          {streaming && streamingContent && (
            <ChatMessage role="assistant" content={streamingContent} />
          )}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput
          onSend={handleSend}
          onCancel={handleCancel}
          onFileUpload={handleFileUpload}
          onFileRemove={handleFileRemove}
          attachments={attachments}
          disabled={streaming}
          streaming={streaming}
        />
      </main>
      <KnowledgePanel visible={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
    </div>
  );
}

export default App;
