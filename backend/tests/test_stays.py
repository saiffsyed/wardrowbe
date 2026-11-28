"""Stays ("where I'll be") and the day-by-day weather that follows them."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.home import Home
from app.models.user import User
from app.services.weather_service import DailyForecast, GeocodingServiceError
from app.utils.timezone import get_user_today

STAYS = "/api/v1/stays"
DAYS = "/api/v1/weather/days"
CHENNAI = (13.08, 80.27)
BANGALORE = (12.97, 77.59)


async def _home(db: AsyncSession, user: User, name: str, city: str, at: tuple) -> Home:
    home = Home(
        user_id=user.id, name=name, city=city, lat=Decimal(str(at[0])), lon=Decimal(str(at[1]))
    )
    db.add(home)
    await db.flush()
    return home


def _forecast(start, count, temp_max):
    return [
        DailyForecast(
            date=(start + timedelta(days=i)).isoformat(),
            temp_min=temp_max - 8,
            temp_max=temp_max,
            precipitation_chance=40,
            condition="cloudy",
            condition_code=3,
            humidity=70,
            uv_index=5,
        )
        for i in range(count)
    ]


class TestStays:
    @pytest.mark.asyncio
    async def test_a_city_is_found_on_the_map_and_saved(
        self, client: AsyncClient, test_user: User, auth_headers
    ):
        today = get_user_today(test_user)
        with patch(
            "app.services.weather_service.WeatherService.geocode_location_name",
            new=AsyncMock(return_value=(*BANGALORE, "Bengaluru")),
        ):
            response = await client.post(
                STAYS,
                json={
                    "city": "  Bangalore ",
                    "start_date": (today + timedelta(days=2)).isoformat(),
                    "end_date": (today + timedelta(days=3)).isoformat(),
                },
                headers=auth_headers,
            )
        assert response.status_code == 201, response.text
        assert response.json()["city"] == "Bangalore"
        listed = (await client.get(STAYS, headers=auth_headers)).json()
        assert [s["city"] for s in listed] == ["Bangalore"]

    @pytest.mark.asyncio
    async def test_an_unknown_city_is_refused_but_a_map_outage_is_not(
        self, client: AsyncClient, test_user: User, auth_headers
    ):
        today = get_user_today(test_user).isoformat()
        body = {"city": "Nowhereville", "start_date": today, "end_date": today}
        with patch(
            "app.services.weather_service.WeatherService.geocode_location_name",
            new=AsyncMock(return_value=None),
        ):
            assert (await client.post(STAYS, json=body, headers=auth_headers)).status_code == 422
        with patch(
            "app.services.weather_service.WeatherService.geocode_location_name",
            new=AsyncMock(side_effect=GeocodingServiceError("down")),
        ):
            assert (await client.post(STAYS, json=body, headers=auth_headers)).status_code == 201

    @pytest.mark.asyncio
    async def test_stays_cannot_overlap_and_dates_must_be_in_order(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        home = await _home(db_session, test_user, "Europe", "Amsterdam", (52.37, 4.9))
        today = get_user_today(test_user)
        first = {
            "city": "x",
            "home_id": str(home.id),
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=4)).isoformat(),
        }
        created = await client.post(STAYS, json=first, headers=auth_headers)
        assert created.status_code == 201
        assert created.json()["city"] == "Europe"  # a home's stay carries the home's name

        clash = {**first, "start_date": (today + timedelta(days=3)).isoformat()}
        assert (await client.post(STAYS, json=clash, headers=auth_headers)).status_code == 409
        backwards = {
            **first,
            "start_date": (today + timedelta(days=9)).isoformat(),
            "end_date": (today + timedelta(days=8)).isoformat(),
        }
        assert (await client.post(STAYS, json=backwards, headers=auth_headers)).status_code == 422

        deleted = await client.delete(f"{STAYS}/{created.json()['id']}", headers=auth_headers)
        assert deleted.status_code == 204
        assert (await client.get(STAYS, headers=auth_headers)).json() == []


class TestWeatherDays:
    @pytest.mark.asyncio
    async def test_days_with_a_stay_take_its_city_and_the_rest_the_current_home(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        chennai = await _home(db_session, test_user, "Chennai", "Chennai", CHENNAI)
        test_user.current_home_id = chennai.id
        await db_session.flush()
        today = get_user_today(test_user)

        async def forecast(self, lat, lon, days=7):
            return _forecast(today, days, 32 if (lat, lon) == CHENNAI else 26)

        with patch(
            "app.services.weather_service.WeatherService.geocode_location_name",
            new=AsyncMock(return_value=(*BANGALORE, "Bengaluru")),
        ):
            await client.post(
                STAYS,
                json={
                    "city": "Bangalore",
                    "start_date": (today + timedelta(days=2)).isoformat(),
                    "end_date": (today + timedelta(days=3)).isoformat(),
                },
                headers=auth_headers,
            )
        with patch(
            "app.services.weather_service.WeatherService.get_daily_forecast", new=forecast
        ) as _:
            response = await client.get(DAYS, params={"days": 5}, headers=auth_headers)

        assert response.status_code == 200, response.text
        days = response.json()["days"]
        assert [d["city"] for d in days] == [
            "Chennai",
            "Chennai",
            "Bangalore",
            "Bangalore",
            "Chennai",
        ]
        assert [d["away"] for d in days] == [False, False, True, True, False]
        assert days[2]["forecast"]["temp_max"] == 26
        assert days[0]["forecast"]["temp_max"] == 32

    @pytest.mark.asyncio
    async def test_a_failed_forecast_leaves_the_days_without_one(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        from app.services.weather_service import WeatherServiceError

        chennai = await _home(db_session, test_user, "Chennai", "Chennai", CHENNAI)
        test_user.current_home_id = chennai.id
        await db_session.flush()
        with patch(
            "app.services.weather_service.WeatherService.get_daily_forecast",
            new=AsyncMock(side_effect=WeatherServiceError("down")),
        ):
            response = await client.get(DAYS, headers=auth_headers)
        assert response.status_code == 200
        assert all(d["forecast"] is None for d in response.json()["days"])
        assert len(response.json()["days"]) == 7

    @pytest.mark.asyncio
    async def test_only_coming_days_can_be_planned(
        self, client: AsyncClient, test_user: User, auth_headers
    ):
        yesterday = get_user_today(test_user) - timedelta(days=1)
        response = await client.post(f"{DAYS}/{yesterday.isoformat()}/outfit", headers=auth_headers)
        assert response.status_code == 400
