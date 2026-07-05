from sqlalchemy import Column, String, Boolean, DateTime, JSON, Integer, Text, func
from .database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    num = Column(Integer, nullable=True)
    title = Column(Text, nullable=False)
    bucket = Column(String(50), default="Karya")
    weightage = Column(String(10), nullable=True)
    time_horizon = Column(String(50), nullable=True)
    life_area = Column(String(100), nullable=True)
    ch = Column(Integer, nullable=True)
    multitask = Column(Boolean, nullable=True)
    state_history = Column(JSON, default=list)
    transition_count = Column(Integer, default=0)
    origin_bucket = Column(String(50), default="Karya")
    completed = Column(Boolean, default=False)
    completed_timestamp = Column(DateTime(timezone=True), nullable=True)
    entry_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    aging_days = Column(Integer, default=0)
