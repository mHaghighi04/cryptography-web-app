from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from .user import UserResponse


class ConversationCreate(BaseModel):
    participant_id: str


class ConversationResponse(BaseModel):
    id: str
    participant1_id: str
    participant2_id: str
    created_at: datetime
    updated_at: datetime
    other_participant: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ConversationWithMessages(BaseModel):
    id: str
    participant1_id: str
    participant2_id: str
    created_at: datetime
    updated_at: datetime
    other_participant: Optional[UserResponse] = None
    messages: List["MessageResponse"] = []

    class Config:
        from_attributes = True


# Avoid circular import
from .message import MessageResponse
ConversationWithMessages.model_rebuild()
