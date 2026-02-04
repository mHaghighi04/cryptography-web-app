import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    participant1_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    participant2_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    participant1 = relationship("User", foreign_keys=[participant1_id])
    participant2 = relationship("User", foreign_keys=[participant2_id])
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")

    def get_other_participant(self, user_id: str):
        """Get the other participant in the conversation."""
        if self.participant1_id == user_id:
            return self.participant2
        return self.participant1

    def __repr__(self):
        return f"<Conversation {self.id}>"
