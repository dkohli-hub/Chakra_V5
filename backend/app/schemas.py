from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class TaskCreate(BaseModel):
    id: Optional[str] = None
    num: Optional[int] = None
    title: str
    bucket: str = "Karya"
    weightage: Optional[str] = None
    time_horizon: Optional[str] = None
    life_area: Optional[str] = None
    ch: Optional[int] = None
    multitask: Optional[bool] = None
    origin_bucket: Optional[str] = "Karya"
    state_history: Optional[List[Any]] = []
    completed: Optional[bool] = False
    completed_timestamp: Optional[datetime] = None
    entry_timestamp: Optional[datetime] = None
    aging_days: Optional[int] = 0


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    bucket: Optional[str] = None
    weightage: Optional[str] = None
    time_horizon: Optional[str] = None
    life_area: Optional[str] = None
    ch: Optional[int] = None
    multitask: Optional[bool] = None
    completed: Optional[bool] = None
    completed_timestamp: Optional[datetime] = None
    state_history: Optional[List[Any]] = None
    transition_count: Optional[int] = None
    aging_days: Optional[int] = None


class TaskOut(BaseModel):
    id: str
    user_id: str
    num: Optional[int]
    title: str
    bucket: str
    weightage: Optional[str]
    time_horizon: Optional[str]
    life_area: Optional[str]
    ch: Optional[int]
    multitask: Optional[bool]
    state_history: List[Any]
    transition_count: int
    origin_bucket: str
    completed: bool
    completed_timestamp: Optional[datetime]
    entry_timestamp: datetime
    aging_days: int

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    user_id: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    user_id: str
    display_name: str


class LLMRequest(BaseModel):
    prompt: str


class LLMResponse(BaseModel):
    text: str


class OCRRequest(BaseModel):
    image_base64: str


class OCRResponse(BaseModel):
    text: str


class BulkImportRequest(BaseModel):
    tasks: List[Any]


class BulkImportResponse(BaseModel):
    added: int
    updated: int
    completed_count: int
