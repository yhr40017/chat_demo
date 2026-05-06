import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  role: 'user' | 'assistant';
  content: string;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-language">{language}</span>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <SyntaxHighlighter style={oneDark} language={language} PreTag="div">
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ChatMessage({ role, content }: Props) {
  return (
    <div className={`message ${role}`}>
      <div className="message-avatar">{role === 'user' ? '👤' : '🤖'}</div>
      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const inline = !match && !String(children).includes('\n');
              if (inline) {
                return <code className="inline-code" {...props}>{children}</code>;
              }
              return (
                <CodeBlock language={match ? match[1] : 'text'}>
                  {String(children).replace(/\n$/, '')}
                </CodeBlock>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
