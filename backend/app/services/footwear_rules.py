"""Weather rules for footwear.

The base scorer already keeps sandals out of the cold and boots out of the heat; this adds the
wet and snowy cases, which depend on the shoe's material and subtype (rain boots, suede loafers,
canvas sneakers...), both of which the tagging AI already extracts.

Two entry points:
- footwear_weather_multiplier() scales a footwear item's weather score (used by item_scorer,
  which only runs on wardrobes of MIN_ITEMS_FOR_SCORING items or more);
- footwear_prompt_hint() adds a line to the outfit prompt so the AI follows the same rule on
  smaller wardrobes, where items reach the prompt unscored.
"""

from app.services.weather_service import WeatherData
from app.utils.clothing import ITEM_ROLE

RAIN_LIKELY_CHANCE = 50

# WMO weather codes (see WeatherService._interpret_weather_code).
WET_CODES = set(range(51, 68)) | {80, 81, 82, 95, 96, 99}
SNOW_CODES = {71, 73, 75, 77, 85, 86}

# Materials that soak through or stain in the wet.
WATER_SENSITIVE_MATERIALS = {"suede", "canvas", "velvet", "knit", "linen", "silk"}
# Subtypes that leave the foot exposed or are hard to walk in on wet or icy ground.
DELICATE_SUBTYPES = {"heels", "mules", "flats", "platforms", "slip-on", "espadrilles"}
WATERPROOF_SUBTYPES = {"rain", "wellington", "wellies", "duck", "snow"}


def is_footwear(item_type: str) -> bool:
    return ITEM_ROLE.get(item_type) == "footwear"


def is_snowy(weather: WeatherData) -> bool:
    return weather.condition_code in SNOW_CODES


def is_wet(weather: WeatherData) -> bool:
    return (
        weather.precipitation_chance > RAIN_LIKELY_CHANCE
        or weather.condition_code in WET_CODES
        or is_snowy(weather)
    )


def footwear_weather_multiplier(
    item_type: str, subtype: str, material: str, weather: WeatherData
) -> float:
    """Return a factor in (0, 1] for a footwear item; 1.0 for anything else or dry weather."""
    if not is_footwear(item_type) or not is_wet(weather):
        return 1.0

    if subtype in WATERPROOF_SUBTYPES:
        return 1.0

    if is_snowy(weather):
        if item_type == "boots":
            factor = 1.0
        elif item_type == "sandals":
            factor = 0.05
        else:
            factor = 0.5
    elif item_type == "boots":
        factor = 0.95
    elif item_type == "sandals":
        factor = 0.3
    elif item_type == "sneakers":
        factor = 0.85 if material == "leather" else 0.7
    else:  # shoes
        factor = 0.85 if material == "leather" else 0.7

    if subtype in DELICATE_SUBTYPES:
        factor *= 0.7
    if material in WATER_SENSITIVE_MATERIALS:
        factor *= 0.4

    return max(0.02, factor)


def footwear_prompt_hint(weather: WeatherData) -> str:
    if is_snowy(weather):
        return (
            "- Footwear: snow is expected, so choose boots (waterproof if available); "
            "avoid sandals, suede, canvas and delicate shoes such as heels or flats."
        )
    if is_wet(weather):
        return (
            "- Footwear: rain is likely, so prefer water-resistant footwear (rain boots, leather "
            "boots or leather shoes); avoid suede, canvas and sandals."
        )
    return ""
