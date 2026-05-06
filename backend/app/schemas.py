from datetime import datetime
from pydantic import BaseModel


class MessageBase(BaseModel):
    role: str
    content: str


class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    title: str = "새 대화"
    model: str = "gemma4:26b"


class ConversationUpdate(BaseModel):
    title: str | None = None
    model: str | None = None


class ConversationResponse(BaseModel):
    id: int
    title: str
    model: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse] = []


class ChatRequest(BaseModel):
    message: str


class ModelResponse(BaseModel):
    name: str
    size: int
    modified_at: str
