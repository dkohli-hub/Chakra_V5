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
    # V9 fields. Columns must exist in Postgres first (ALTER TABLE ... ADD COLUMN).
    short_title = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    linked_tasks = Column(JSON, nullable=True)
    depends_on = Column(String, nullable=True)
    # V14 Set Deadline picker. Columns must exist in Postgres first (add_v14_columns.py).
    due_date = Column(String(10), nullable=True)    # YYYY-MM-DD
    due_time = Column(String(5), nullable=True)     # HH:MM, optional
    duration_min = Column(Integer, nullable=True)   # task length in minutes
    # V15: when the date was last changed (ISO string). Restarts the overdue/Tamas clock.
    deadline_set_at = Column(String(40), nullable=True)
    # V17: task arrived with no date and was defaulted to Saturday 11:59 PM.
    no_date_given = Column(Boolean, nullable=True)
