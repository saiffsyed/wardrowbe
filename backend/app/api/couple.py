"""Couple coordination (our fork): your partner's planned looks beside yours.

The partner is a member of your family: the one you chose, or, in a family of two, the other
member. Your partner sees only looks planned on days, never your wardrobe, and only while
your "share my planned looks" switch is on (it is on by default).
"""

from datetime import date, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.outfits import OutfitResponse, outfit_to_response
from app.database import DbSession
from app.models.couple import CoupleSettings
from app.models.user import User
from app.services.outfit_service import OutfitListFilters, OutfitService
from app.utils.auth import get_current_user

router = APIRouter(prefix="/couple", tags=["Couple"])

MAX_DAYS = 62


class PartnerInfo(BaseModel):
    id: UUID
    display_name: str
    avatar_url: str | None = None


class CoupleResponse(BaseModel):
    partner: PartnerInfo | None
    # Whether the partner shares their planned looks with you.
    partner_shares: bool
    share_plans: bool
    # Other family members you could pick as partner (when there are more than one).
    choices: list[PartnerInfo]


class CoupleUpdate(BaseModel):
    share_plans: bool | None = None
    partner_id: UUID | None = None


async def _settings(db, user_id: UUID) -> CoupleSettings | None:
    return await db.get(CoupleSettings, user_id)


async def _family_others(db, user: User) -> list[User]:
    if not user.family_id:
        return []
    result = await db.execute(
        select(User).where(
            User.family_id == user.family_id,
            User.id != user.id,
            User.is_active == True,  # noqa: E712
        )
    )
    return list(result.scalars())


async def partner_of(db, user: User) -> User | None:
    """The partner: the one chosen if still in the family, else the only other member."""
    others = await _family_others(db, user)
    mine = await _settings(db, user.id)
    if mine and mine.partner_id:
        chosen = next((other for other in others if other.id == mine.partner_id), None)
        if chosen:
            return chosen
    return others[0] if len(others) == 1 else None


async def shares_with_partner(db, user_id: UUID) -> bool:
    mine = await _settings(db, user_id)
    return True if mine is None else mine.share_plans


def _info(user: User) -> PartnerInfo:
    return PartnerInfo(id=user.id, display_name=user.display_name, avatar_url=user.avatar_url)


async def _response(db, user: User) -> CoupleResponse:
    partner = await partner_of(db, user)
    others = await _family_others(db, user)
    return CoupleResponse(
        partner=_info(partner) if partner else None,
        partner_shares=await shares_with_partner(db, partner.id) if partner else False,
        share_plans=await shares_with_partner(db, user.id),
        choices=[_info(other) for other in others] if len(others) > 1 else [],
    )


@router.get("", response_model=CoupleResponse)
async def get_couple(
    db: DbSession, current_user: Annotated[User, Depends(get_current_user)]
) -> CoupleResponse:
    return await _response(db, current_user)


@router.patch("", response_model=CoupleResponse)
async def update_couple(
    body: CoupleUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_user)]
) -> CoupleResponse:
    row = await _settings(db, current_user.id)
    if row is None:
        row = CoupleSettings(user_id=current_user.id, share_plans=True)
        db.add(row)
    if body.share_plans is not None:
        row.share_plans = body.share_plans
    if body.partner_id is not None:
        others = await _family_others(db, current_user)
        if body.partner_id not in {other.id for other in others}:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not in your family")
        row.partner_id = body.partner_id
    await db.flush()
    return await _response(db, current_user)


@router.get("/plans", response_model=list[OutfitResponse])
async def partner_plans(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    date_from: date = Query(...),
    date_to: date = Query(...),
) -> list[OutfitResponse]:
    """The partner's looks planned between two days, when they share them."""
    if date_to < date_from or date_to - date_from > timedelta(days=MAX_DAYS):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Bad date range")
    partner = await partner_of(db, current_user)
    if partner is None or not await shares_with_partner(db, partner.id):
        return []
    service = OutfitService(db)
    outfits, _ = await service.list_with_filters(
        OutfitListFilters(
            user_id=partner.id, date_from=date_from, date_to=date_to, family_member_view=True
        ),
        1,
        100,
    )
    return [outfit_to_response(outfit) for outfit in outfits]
