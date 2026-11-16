"""The wardrobe's category chips: Tops, Bottoms, Traditional and so on.

A category is a named group of garment types, chosen for how a person looks through a wardrobe
rather than for how an outfit is put together (that is what a type's role is for). Traditional
wear is one group although its pieces play different roles, and jewellery is apart from other
accessories. Every garment type belongs to exactly one category; a test holds that true when
types are added. The frontend lists the same keys in `frontend/lib/wardrobe-categories.ts`.
"""

CATEGORY_TYPES: dict[str, tuple[str, ...]] = {
    "tops": (
        "shirt",
        "t-shirt",
        "top",
        "sweater",
        "polo",
        "blouse",
        "tank-top",
        "camisole",
        "bodysuit",
        "sweatshirt",
        "vest",
        "cardigan",
    ),
    "bottoms": ("pants", "jeans", "shorts", "skirt", "leggings", "overalls", "tights"),
    "dresses": ("dress", "jumpsuit", "suit"),
    "outerwear": ("jacket", "coat", "hoodie", "blazer", "poncho"),
    "traditional": (
        "kurta",
        "sherwani",
        "saree",
        "lehenga",
        "salwar-kameez",
        "dupatta",
        "dhoti",
        "mojari",
    ),
    "shoes": ("shoes", "sneakers", "boots", "sandals", "heels", "flats", "socks"),
    "jewellery": ("ring", "necklace", "earrings", "bracelet", "bangles", "cufflinks", "watch"),
    "accessories": ("hat", "scarf", "belt", "bag", "accessories", "tie"),
}


def types_in(category: str) -> tuple[str, ...] | None:
    """The garment types of a category, or None for a name that is not one."""
    return CATEGORY_TYPES.get(category)
