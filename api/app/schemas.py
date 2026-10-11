"""HTTP request/response Pydantic models shared by API routers."""

from __future__ import annotations

from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.storyboards import Storyboard


class CreateJobRequest(BaseModel):
    brief: str | None = Field(default=None, max_length=4000)
    urls: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)
    template: str | None = Field(default=None, max_length=64)
    language: Literal["en", "km"] = "en"


class StoryboardEditRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    storyboard: Storyboard
    expected_updated_at: str = Field(min_length=1, max_length=100)


class StoryboardRevisionRequest(StoryboardEditRequest):
    action: Literal["stronger_hook", "shorter", "change_ending"]


class RedraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["stronger_hook", "shorter", "change_ending"] | None = None


class DraftRetryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_updated_at: str = Field(min_length=1, max_length=100)


class CreatePromotionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["shop", "product", "service", "other"]
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1500)
    benefit: str = Field(default="", max_length=1000)
    location: str = Field(default="", max_length=300)
    website: str = Field(default="", max_length=500)

    @field_validator("name", "description", "benefit", "location", "website", mode="before")
    @classmethod
    def trim_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("website")
    @classmethod
    def validate_website(cls, value: str) -> str:
        if not value:
            return value
        try:
            parsed = urlsplit(value)
            valid = parsed.scheme in {"http", "https"} and bool(parsed.hostname)
            _ = parsed.port  # Reject malformed ports rather than saving an unusable link.
        except ValueError:
            valid = False
        if not valid or any(char.isspace() for char in value):
            raise ValueError("Use a full website URL beginning with https:// or http://.")
        return value


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class IntegrationsUpdateRequest(BaseModel):
    telegram_bot_token: str | None = Field(default=None, max_length=200)
    telegram_user_id: int | None = None
    gemini_api_keys: str | None = Field(default=None, max_length=4000)
    gemini_model: str | None = Field(default=None, max_length=120)
    skip_notebooklm: bool | None = None
    clear_telegram_bot_token: bool = False
    clear_gemini_api_keys: bool = False


class FacebookSelectPageRequest(BaseModel):
    page_id: str = Field(min_length=1, max_length=64)


class IngestUrlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=4, max_length=1000)


class WeeklyPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    brief: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=4000)
    urls: list[str] = Field(default_factory=list)
    language: Literal["en", "km"] = "en"


class WeeklyPlanPost(BaseModel):
    model_config = ConfigDict(extra="forbid")
    day: Literal["monday", "wednesday", "friday"]
    role: Literal["awareness", "product", "offer"]
    title: str = Field(min_length=1, max_length=120)
    angle: str = Field(min_length=1, max_length=500)
    cta: str = Field(min_length=1, max_length=200)
    brief_delta: str = Field(min_length=1, max_length=1500)
    notes_delta: str = Field(min_length=1, max_length=1500)


class WeeklyPlanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    posts: list[WeeklyPlanPost] = Field(min_length=3, max_length=3)
