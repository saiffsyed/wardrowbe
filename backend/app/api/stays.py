"""Where a person will be ("stays") and the day-by-day weather that follows from it.

A day with a stay uses the stay's city; every other day uses the current home's city (or the
location saved before homes existed). The weather screen, the wardrobe's weather bar and
"Plan outfit" all read the same days from here.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select

from app.api.outfits import (
    OutfitResponse,
    _default_occasion,
    fetch_wore_instead_items_map,
    outfit_to_response,
)
from app.database import DbSession
from app.models.home import Home
from app.models.stay import Stay
from app.models.user import User
from app.schemas.text import SingleLineName
from app.services.recommendation_service import (
    InsufficientWardrobeError,
    RecommendationService,
)
from app.services.weather_service import (
    DailyForecast,
    GeocodingServiceError,
    WeatherData,
    WeatherService,
    WeatherServiceError,
)
from app.utils.auth import get_current_user
from app.utils.timezone import get_user_today

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stays", tags=["Stays"])
days_router = APIRouter(prefix="/weather", tags=["Weather"])

# Open-Meteo forecasts reach 16 days ahead; a stay further out shows no forecast yet.
FORECAST_DAYS = 16
MAX_STAY_DAYS = 120
MAX_STAYS = 200


class StayCreate(BaseModel):
    city: SingleLineName = Field(min_length=1, max_length=100)
    home_id: UUID | None = None
    start_date: date
    end_date: date

    @field_validator("city", mode="before")
    @classmethod
    def tidy_city(cls, value: object) -> object:
        return " ".join(value.split()) if isinstance(value, str) else value

    @model_validator(mode="after")
    def dates_in_order(self) -> "StayCreate":
        if self.end_date < self.start_date:
            raise ValueError("The last day comes before the first")
        if (self.end_date - self.start_date).days >= MAX_STAY_DAYS:
            raise ValueError(f"A stay can be at most {MAX_STAY_DAYS} days")
        return self


class StayResponse(BaseModel):
    id: UUID
    city: str
    home_id: UUID | None
    start_date: date
    end_date: date


class DayForecast(BaseModel):
    temp_min: float
    temp_max: float
    precipitation_chance: int
    humidity: int | None
    uv_index: float | None
    condition: str


class WeatherDay(BaseModel):
    date: date
    city: str | None
    # True when the day's city comes from a stay rather than the current home.
    away: bool
    stay_id: UUID | None = None
    home_id: UUID | None = None
    # None when the forecast does not reach this far yet, or could not be fetched.
    forecast: DayForecast | None = None


class DayWeatherResponse(BaseModel):
    days: list[WeatherDay]


def _stay_response(stay: Stay) -> StayResponse:
    return StayResponse(
        id=stay.id,
        city=stay.city,
        home_id=stay.home_id,
        start_date=stay.start_date,
        end_date=stay.end_date,
    )


async def _overlapping(
    db: DbSession, user: User, start: date, end: date, except_id: UUID | None = None
) -> Stay | None:
    query = select(Stay).where(
        Stay.user_id == user.id, Stay.start_date <= end, Stay.end_date >= start
    )
    if except_id is not None:
        query = query.where(Stay.id != except_id)
    return (await db.execute(query.limit(1))).scalar_one_or_none()


async def _geocode(city: str) -> tuple[float, float] | None:
    """The city's coordinates, or None when it was not found or the map service failed."""
    try:
        found = await WeatherService().geocode_location_name(city)
    except GeocodingServiceError as e:
        logger.warning("Could not look up %s: %s", city, e)
        return None
    return (found[0], found[1]) if found else None


@router.get("", response_model=list[StayResponse])
async def list_stays(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StayResponse]:
    query = select(Stay).where(Stay.user_id == current_user.id)
    if date_from is not None:
        query = query.where(Stay.end_date >= date_from)
    if date_to is not None:
        query = query.where(Stay.start_date <= date_to)
    stays = (await db.execute(query.order_by(Stay.start_date))).scalars().all()
    return [_stay_response(stay) for stay in stays]


@router.post("", response_model=StayResponse, status_code=status.HTTP_201_CREATED)
async def create_stay(
    body: StayCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> StayResponse:
    count = len((await db.execute(select(Stay.id).where(Stay.user_id == current_user.id))).all())
    if count >= MAX_STAYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Too many stays")
    clash = await _overlapping(db, current_user, body.start_date, body.end_date)
    if clash is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Those days overlap your stay in {clash.city}",
        )

    city = body.city
    lat = lon = None
    if body.home_id is not None:
        home = (
            await db.execute(
                select(Home).where(Home.id == body.home_id, Home.user_id == current_user.id)
            )
        ).scalar_one_or_none()
        if home is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Home not found")
        city, lat, lon = home.name, home.lat, home.lon
    else:
        try:
            found = await WeatherService().geocode_location_name(city)
        except GeocodingServiceError as e:
            # Saved all the same; the weather looks the city up again when it is needed.
            logger.warning("Could not look up %s: %s", city, e)
            found = ()
        if found is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"Could not find a city called {city}"
            )
        if found:
            lat, lon = found[0], found[1]

    stay = Stay(
        user_id=current_user.id,
        home_id=body.home_id,
        city=city,
        lat=lat,
        lon=lon,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(stay)
    await db.flush()
    return _stay_response(stay)


@router.delete("/{stay_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stay(
    stay_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    stay = (
        await db.execute(select(Stay).where(Stay.id == stay_id, Stay.user_id == current_user.id))
    ).scalar_one_or_none()
    if stay is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stay not found")
    await db.delete(stay)
    await db.flush()


@dataclass(frozen=True)
class _Place:
    city: str | None
    lat: float | None
    lon: float | None
    away: bool
    stay_id: UUID | None = None
    home_id: UUID | None = None


async def _home_place(db: DbSession, user: User) -> _Place:
    if user.current_home_id is not None:
        home = await db.get(Home, user.current_home_id)
        if home is not None:
            return _Place(
                city=home.city,
                lat=float(home.lat) if home.lat is not None else None,
                lon=float(home.lon) if home.lon is not None else None,
                away=False,
                home_id=home.id,
            )
    return _Place(
        city=user.location_name,
        lat=float(user.location_lat) if user.location_lat is not None else None,
        lon=float(user.location_lon) if user.location_lon is not None else None,
        away=False,
    )


def _stay_place(stay: Stay) -> _Place:
    return _Place(
        city=stay.city,
        lat=float(stay.lat) if stay.lat is not None else None,
        lon=float(stay.lon) if stay.lon is not None else None,
        away=True,
        stay_id=stay.id,
        home_id=stay.home_id,
    )


async def places_for_days(db: DbSession, user: User, start: date, count: int) -> list[_Place]:
    """Where the person will be on each of `count` days from `start`."""
    end = start + timedelta(days=count - 1)
    stays = (
        (
            await db.execute(
                select(Stay).where(
                    Stay.user_id == user.id, Stay.start_date <= end, Stay.end_date >= start
                )
            )
        )
        .scalars()
        .all()
    )
    home = await _home_place(db, user)
    places = []
    for offset in range(count):
        day = start + timedelta(days=offset)
        stay = next((s for s in stays if s.start_date <= day <= s.end_date), None)
        places.append(_stay_place(stay) if stay else home)
    return places


async def _forecasts_by_place(
    places: list[_Place], start: date, count: int
) -> dict[tuple[float, float], dict[str, DailyForecast]]:
    """One forecast request per distinct city, however many days it covers."""
    service = WeatherService()
    reach = min(FORECAST_DAYS, count)
    by_place: dict[tuple[float, float], dict[str, DailyForecast]] = {}
    for place in {(p.lat, p.lon) for p in places if p.lat is not None and p.lon is not None}:
        try:
            days = await service.get_daily_forecast(place[0], place[1], days=reach)
        except (WeatherServiceError, ValueError) as e:
            logger.warning("Forecast failed for %s: %s", place, e)
            continue
        by_place[place] = {d.date: d for d in days}
    return by_place


async def _with_coordinates(places: list[_Place]) -> list[_Place]:
    """Look up the coordinates of any city saved without them (once per city name)."""
    looked_up: dict[str, tuple[float, float] | None] = {}
    result = []
    for place in places:
        if place.lat is None and place.city:
            if place.city not in looked_up:
                looked_up[place.city] = await _geocode(place.city)
            found = looked_up[place.city]
            if found:
                place = _Place(
                    place.city, found[0], found[1], place.away, place.stay_id, place.home_id
                )
        result.append(place)
    return result


@days_router.get("/days", response_model=DayWeatherResponse)
async def weather_days(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = Query(7, ge=1, le=FORECAST_DAYS),
) -> DayWeatherResponse:
    """Today and the next days, each with the city the person will be in and its forecast."""
    start = get_user_today(current_user)
    places = await _with_coordinates(await places_for_days(db, current_user, start, days))
    forecasts = await _forecasts_by_place(places, start, days)

    result = []
    for offset, place in enumerate(places):
        day = start + timedelta(days=offset)
        forecast = forecasts.get((place.lat, place.lon), {}).get(day.isoformat())
        result.append(
            WeatherDay(
                date=day,
                city=place.city,
                away=place.away,
                stay_id=place.stay_id,
                home_id=place.home_id,
                forecast=DayForecast(
                    temp_min=forecast.temp_min,
                    temp_max=forecast.temp_max,
                    precipitation_chance=int(forecast.precipitation_chance or 0),
                    humidity=forecast.humidity,
                    uv_index=forecast.uv_index,
                    condition=forecast.condition,
                )
                if forecast
                else None,
            )
        )
    return DayWeatherResponse(days=result)


def _day_weather(forecast: DailyForecast) -> WeatherData:
    """A day's forecast in the shape the outfit picker reads, using the warmest part of the
    day, which decides most of what to wear."""
    return WeatherData(
        temperature=forecast.temp_max,
        feels_like=forecast.temp_max,
        humidity=forecast.humidity if forecast.humidity is not None else 50,
        precipitation_chance=int(forecast.precipitation_chance or 0),
        precipitation_mm=0,
        wind_speed=forecast.wind_speed or 0,
        condition=forecast.condition,
        condition_code=forecast.condition_code,
        is_day=True,
        uv_index=forecast.uv_index or 0,
        timestamp=datetime.now(UTC),
        temp_min=forecast.temp_min,
        temp_max=forecast.temp_max,
    )


@days_router.post("/days/{day}/outfit", response_model=OutfitResponse)
async def plan_outfit_for_day(
    day: date,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> OutfitResponse:
    """Suggest an outfit for that day's weather in the city the person will be in, saved to
    that day."""
    today = get_user_today(current_user)
    offset = (day - today).days
    if offset < 0 or offset >= FORECAST_DAYS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only today and the next 15 days can be planned"
        )
    place = (await _with_coordinates(await places_for_days(db, current_user, day, 1)))[0]
    forecasts = await _forecasts_by_place([place], today, offset + 1)
    forecast = forecasts.get((place.lat, place.lon), {}).get(day.isoformat())
    weather = _day_weather(forecast) if forecast else None

    service = RecommendationService(db)
    try:
        outfit = await service.generate_recommendation(
            user=current_user,
            occasion=_default_occasion(current_user),
            weather_override=weather,
            scheduled_date=day,
        )
    except InsufficientWardrobeError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None
    wore_instead_map = await fetch_wore_instead_items_map(db, [outfit], user_id=current_user.id)
    return outfit_to_response(outfit, wore_instead_map)
