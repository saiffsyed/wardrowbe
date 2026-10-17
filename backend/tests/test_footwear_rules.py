from datetime import datetime
from uuid import uuid4

import pytest

from app.models.item import ClothingItem
from app.services.footwear_rules import (
    footwear_prompt_hint,
    footwear_weather_multiplier,
    is_snowy,
    is_wet,
)
from app.services.item_scorer import _weather_score
from app.services.recommendation_service import weather_notes_text
from app.services.weather_service import WeatherData

CLEAR, LIGHT_RAIN, HEAVY_SNOW = 0, 61, 75


def _weather(temp=12, precipitation=0, code=CLEAR) -> WeatherData:
    return WeatherData(
        temperature=temp,
        feels_like=temp,
        humidity=60,
        precipitation_chance=precipitation,
        precipitation_mm=0,
        wind_speed=5,
        condition="test",
        condition_code=code,
        is_day=True,
        uv_index=1,
        timestamp=datetime(2026, 10, 17, 9),
    )


def _shoe(item_type="shoes", subtype=None, material=None) -> ClothingItem:
    return ClothingItem(
        id=uuid4(),
        user_id=uuid4(),
        image_path="x.jpg",
        type=item_type,
        subtype=subtype,
        material=material,
        season=[],
        formality="casual",
    )


class TestConditions:
    def test_dry_day_is_neither_wet_nor_snowy(self):
        w = _weather()
        assert not is_wet(w)
        assert not is_snowy(w)

    def test_high_rain_chance_is_wet(self):
        assert is_wet(_weather(precipitation=70))

    def test_raining_now_is_wet_even_with_low_forecast_chance(self):
        assert is_wet(_weather(precipitation=10, code=LIGHT_RAIN))

    def test_snow_counts_as_wet_and_snowy(self):
        w = _weather(temp=-2, code=HEAVY_SNOW)
        assert is_snowy(w)
        assert is_wet(w)


class TestMultiplier:
    def test_dry_weather_changes_nothing(self):
        assert footwear_weather_multiplier("shoes", "loafers", "suede", _weather()) == 1.0

    def test_non_footwear_is_never_touched(self):
        rain = _weather(precipitation=80)
        assert footwear_weather_multiplier("jacket", "", "suede", rain) == 1.0

    def test_rain_boots_stay_top_choice(self):
        rain = _weather(precipitation=80)
        assert footwear_weather_multiplier("boots", "rain", "", rain) == 1.0

    def test_rain_ranks_boots_over_leather_over_canvas_over_suede(self):
        rain = _weather(precipitation=80)
        boots = footwear_weather_multiplier("boots", "chelsea", "leather", rain)
        leather = footwear_weather_multiplier("shoes", "oxfords", "leather", rain)
        canvas = footwear_weather_multiplier("sneakers", "low-top", "canvas", rain)
        suede = footwear_weather_multiplier("shoes", "loafers", "suede", rain)
        assert boots > leather > canvas
        assert leather > suede
        assert suede < 0.5

    def test_sandals_are_heavily_penalised_in_rain(self):
        assert footwear_weather_multiplier("sandals", "", "", _weather(precipitation=80)) <= 0.3

    def test_heels_are_penalised_in_rain(self):
        rain = _weather(precipitation=80)
        heels = footwear_weather_multiplier("shoes", "heels", "leather", rain)
        oxfords = footwear_weather_multiplier("shoes", "oxfords", "leather", rain)
        assert heels < oxfords

    def test_snow_wants_boots(self):
        snow = _weather(temp=-2, code=HEAVY_SNOW)
        assert footwear_weather_multiplier("boots", "ankle", "leather", snow) == 1.0
        assert footwear_weather_multiplier("sneakers", "", "leather", snow) <= 0.5
        assert footwear_weather_multiplier("sandals", "", "", snow) <= 0.05

    def test_never_returns_zero(self):
        snow = _weather(temp=-2, code=HEAVY_SNOW)
        assert footwear_weather_multiplier("sandals", "heels", "velvet", snow) > 0


class TestScorerIntegration:
    @pytest.mark.parametrize(
        ("dry_type", "dry_material"),
        [("shoes", "suede"), ("sneakers", "canvas")],
    )
    def test_rain_lowers_water_sensitive_shoes_below_leather_boots(self, dry_type, dry_material):
        rain = _weather(precipitation=80)
        sensitive = _weather_score(_shoe(dry_type, material=dry_material), rain, None)
        boots = _weather_score(_shoe("boots", "chelsea", "leather"), rain, None)
        assert boots > sensitive

    def test_dry_mild_day_scores_shoes_as_before(self):
        assert _weather_score(_shoe("shoes", "loafers", "suede"), _weather(), None) == 1.0


class TestPromptHint:
    def test_no_hint_on_a_dry_day(self):
        assert footwear_prompt_hint(_weather()) == ""

    def test_rain_hint_mentions_avoiding_suede(self):
        hint = footwear_prompt_hint(_weather(precipitation=80))
        assert "rain" in hint.lower()
        assert "suede" in hint

    def test_snow_hint_mentions_boots(self):
        assert "boots" in footwear_prompt_hint(_weather(temp=-2, code=HEAVY_SNOW))

    def test_weather_notes_include_footwear_line_when_wet(self):
        assert "Footwear" in weather_notes_text(_weather(precipitation=80))

    def test_weather_notes_empty_on_a_calm_dry_day(self):
        assert weather_notes_text(_weather()) == ""
