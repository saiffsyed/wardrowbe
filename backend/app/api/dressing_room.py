"""Dressing-room settings (our fork): each person picks a women's or men's figure, its colour
and the background behind it."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import DbSession
from app.models.dressing_room import DressingRoomSettings
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/dressing-room", tags=["Dressing room"])

# The colours offered in Settings; "auto" follows the app's light or dark mode.
BACKGROUNDS = ("auto", "#ffffff", "#f6f1e7", "#e9ecea", "#dfe7e2", "#111316")
FIGURE_COLOURS = ("auto", "#e3e6e5", "#eddcc8", "#a47e5f", "#5f6664", "#ffffff")


class SettingsBody(BaseModel):
    figure: Literal["women", "men"] | None = None
    background: str | None = None
    figure_colour: str | None = None


class SettingsResponse(BaseModel):
    figure: Literal["women", "men"]
    background: str
    figure_colour: str


def _response(row: DressingRoomSettings | None) -> SettingsResponse:
    if row is None:
        return SettingsResponse(figure="women", background="auto", figure_colour="auto")
    return SettingsResponse(
        figure=row.figure,  # type: ignore[arg-type]
        background=row.background,
        figure_colour=row.figure_colour,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    db: DbSession, current_user: Annotated[User, Depends(get_current_user)]
) -> SettingsResponse:
    return _response(await db.get(DressingRoomSettings, current_user.id))


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsBody,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> SettingsResponse:
    if body.background is not None and body.background not in BACKGROUNDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown background")
    if body.figure_colour is not None and body.figure_colour not in FIGURE_COLOURS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown figure colour")
    row = await db.get(DressingRoomSettings, current_user.id)
    if row is None:
        row = DressingRoomSettings(
            user_id=current_user.id, figure="women", background="auto", figure_colour="auto"
        )
        db.add(row)
    if body.figure is not None:
        row.figure = body.figure
    if body.background is not None:
        row.background = body.background
    if body.figure_colour is not None:
        row.figure_colour = body.figure_colour
    await db.flush()
    return _response(row)
