export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface Attachment {
  id: number;
  filename: string;
  file_size: number;
  created_at: string;
}

export interface KnowledgeDoc {
  id: number;
  filename: string;
  file_size: number;
  chunk_count: number;
  status: 'processing' | 'ready' | 'error';
  error_message?: string;
  created_at: string;
}
