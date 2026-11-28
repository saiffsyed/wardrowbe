"""The wardrobe's categories: a few main groups, each opening into smaller ones.

A category is a named group of garment types, chosen for how a person looks through a wardrobe
rather than for how an outfit is put together (that is what a type's role is for). The tree is
two levels deep: Indian wear > Sarees, Jewellery > Earrings. Garment types hang off the second
level only, and each type belongs to at most one place.

Everyone starts from DEFAULT_GROUPS. A person can then rename, add, remove and re-fill groups
in Settings; their own tree is stored whole and replaces the default for them. Built-in groups
carry a `key` the screens translate; a group a person made or renamed carries a `name`.

A person can also add kinds of item of their own ("pattu pavadai"). Each is a kind of one
built-in type and is stored on an item as that type plus the kind's name as the subtype. Left
alone it sits wherever its built-in type sits; ticked into a sub-group, it moves there.
"""

import re
from dataclasses import dataclass, field

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func

from app.utils.garment_vocabulary import TYPES

MAX_GROUPS = 12
MAX_SUBGROUPS = 14
_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")
_VALID_TYPES = frozenset(TYPES)


def _clean_name(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


class _Named(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    # A built-in group's translation key. Kept when a person leaves the name alone.
    key: str | None = Field(None, max_length=40)
    # A name the person typed. Wins over the key.
    name: str | None = Field(None, max_length=30)

    @field_validator("id")
    @classmethod
    def _id_is_a_slug(cls, value: str) -> str:
        if not _ID.match(value):
            raise ValueError("a category id is lower-case letters, digits and hyphens")
        return value

    @field_validator("name")
    @classmethod
    def _tidy_name(cls, value: str | None) -> str | None:
        return _clean_name(value)

    @model_validator(mode="after")
    def _has_a_label(self) -> "_Named":
        if not self.key and not self.name:
            raise ValueError("a category needs a name")
        return self


class SubGroup(_Named):
    types: list[str] = Field(default_factory=list, max_length=len(TYPES))
    # Ids of the person's own kinds of item that were put in this sub-group.
    kinds: list[str] = Field(default_factory=list, max_length=60)

    @field_validator("kinds")
    @classmethod
    def _kinds_once(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))

    @field_validator("types")
    @classmethod
    def _known_types_once(cls, value: list[str]) -> list[str]:
        unknown = [t for t in value if t not in _VALID_TYPES]
        if unknown:
            raise ValueError(f"not an item type: {unknown[0]}")
        return list(dict.fromkeys(value))


class Group(_Named):
    children: list[SubGroup] = Field(default_factory=list, max_length=MAX_SUBGROUPS)


class CategoryTree(BaseModel):
    groups: list[Group] = Field(max_length=MAX_GROUPS)

    @model_validator(mode="after")
    def _ids_and_types_are_unique(self) -> "CategoryTree":
        ids = [g.id for g in self.groups] + [c.id for g in self.groups for c in g.children]
        if len(ids) != len(set(ids)):
            raise ValueError("two categories share an id")
        placed = [t for g in self.groups for c in g.children for t in c.types]
        if len(placed) != len(set(placed)):
            repeated = next(t for t in placed if placed.count(t) > 1)
            raise ValueError(f"{repeated} is in more than one category")
        kinds = [k for g in self.groups for c in g.children for k in c.kinds]
        if len(kinds) != len(set(kinds)):
            raise ValueError("one of your own kinds of item is in more than one category")
        return self


def _group(key: str, children: list[tuple[str, tuple[str, ...]]]) -> Group:
    return Group(
        id=key,
        key=key,
        children=[SubGroup(id=child, key=child, types=list(types)) for child, types in children],
    )


DEFAULT_GROUPS: tuple[Group, ...] = (
    _group(
        "indian",
        [
            ("sarees", ("saree", "saree-blouse", "petticoat")),
            ("kurtas-suits", ("kurta", "kurti", "salwar-kameez", "anarkali", "sherwani")),
            ("lehengas", ("lehenga", "half-saree", "sharara")),
            ("dupattas", ("dupatta", "stole")),
            ("indian-bottoms", ("churidar", "palazzo", "patiala", "dhoti")),
        ],
    ),
    _group(
        "western",
        [
            (
                "tops",
                (
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
            ),
            (
                "bottoms",
                ("pants", "jeans", "shorts", "skirt", "leggings", "overalls", "tights"),
            ),
            ("dresses", ("dress", "jumpsuit", "suit")),
            ("outerwear", ("jacket", "coat", "hoodie", "blazer", "poncho")),
        ],
    ),
    _group(
        "shoes",
        [
            ("indian-shoes", ("mojari", "juttis", "kolhapuris")),
            ("flats-sandals", ("flats", "sandals")),
            ("heels", ("heels",)),
            ("sneakers", ("sneakers",)),
            ("boots", ("boots",)),
            ("formal-shoes", ("shoes",)),
            ("socks", ("socks",)),
        ],
    ),
    _group(
        "jewellery",
        [
            ("necklaces", ("necklace", "mangalsutra")),
            ("earrings", ("earrings", "jhumkas")),
            ("bangles", ("bangles", "bracelet")),
            ("rings", ("ring", "nose-ring")),
            ("hair-head", ("maang-tikka", "hair-jewellery")),
            ("anklets", ("anklets", "toe-rings")),
            ("waist-belts", ("waist-belt",)),
            ("watches", ("watch",)),
        ],
    ),
    _group(
        "accessories",
        [
            ("bags", ("bag", "clutch", "potli")),
            ("belts", ("belt",)),
            ("scarves", ("scarf",)),
            ("hats", ("hat",)),
            ("ties", ("tie", "cufflinks")),
            ("other-accessories", ("accessories",)),
        ],
    ),
)


def default_tree() -> CategoryTree:
    return CategoryTree(groups=[group.model_copy(deep=True) for group in DEFAULT_GROUPS])


# A person's own kind of item as an item carries it: (built-in type, lower-cased name).
KindPair = tuple[str, str]


@dataclass(frozen=True)
class CategoryFilter:
    """Which items a category holds: those of its built-in types, except the person's own
    kinds that were moved to another category, plus their own kinds that were moved into it."""

    types: tuple[str, ...] = ()
    moved_in: tuple[KindPair, ...] = ()
    moved_out: tuple[KindPair, ...] = field(default=())

    def holds(self, type_: str, subtype: str) -> bool:
        pair = (type_, subtype)
        return pair in self.moved_in or (type_ in self.types and pair not in self.moved_out)


def subtype_as_kind(column):
    """An item's subtype as SQL in the same form as a kind's name: trimmed, single-spaced,
    lower-cased. NULL becomes the empty string."""
    return func.lower(func.regexp_replace(func.trim(func.coalesce(column, "")), r"\s+", " ", "g"))


def kind_pair(base_type: str, name: str) -> KindPair:
    return (base_type, " ".join(name.split()).lower())


def filter_for(
    tree: CategoryTree, category_id: str, kinds: dict[str, KindPair] | None = None
) -> CategoryFilter:
    """What a group or a sub-group holds. For an id that is neither it holds nothing, so an
    unknown category matches no item rather than every item. `kinds` maps the id of each of
    the person's own kinds to its pair; ids in the tree that are no longer in it are ignored."""
    kinds = kinds or {}
    inside: list[SubGroup] = []
    outside: list[SubGroup] = []
    for group in tree.groups:
        whole_group = group.id == category_id
        for child in group.children:
            (inside if whole_group or child.id == category_id else outside).append(child)
    types = tuple(t for child in inside for t in child.types)
    return CategoryFilter(
        types=types,
        moved_in=tuple(kinds[k] for child in inside for k in child.kinds if k in kinds),
        moved_out=tuple(
            kinds[k]
            for child in outside
            for k in child.kinds
            if k in kinds and kinds[k][0] in types
        ),
    )


def types_in(tree: CategoryTree, category_id: str) -> tuple[str, ...]:
    """The built-in garment types under a group or a sub-group."""
    return filter_for(tree, category_id).types


def unplaced_types(tree: CategoryTree) -> list[str]:
    """Garment types that are in no category, in vocabulary order."""
    placed = {t for group in tree.groups for child in group.children for t in child.types}
    return [t for t in TYPES if t not in placed]
