import React, { useState } from 'react';
import { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
}

export default function Sidebar({ conversations, activeId, onSelect, onCreate, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const confirmEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmEdit();
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <aside className="sidebar">
      <button className="new-chat-btn" onClick={onCreate}>
        + 새 대화
      </button>
      <div className="conversation-list">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${conv.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            {editingId === conv.id ? (
              <input
                className="rename-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={confirmEdit}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span
                className="conversation-title"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing(conv);
                }}
              >
                {conv.title}
              </span>
            )}
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
