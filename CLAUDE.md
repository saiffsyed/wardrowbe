# Our wardrobe app (fork of Wardrowbe)

This repository is `saiffsyed/wardrowbe`, a private fork of the open-source
[Wardrowbe](https://github.com/Anyesh/wardrowbe) (MIT). It is being simplified and
personalised into a private wardrobe app for Saiff (Android), his partner (iPhone) and at
most one or two family members. It is not a public product.

**Read `docs/product-plan.md` before any product work.** It records every decision made so
far, what is built, and what comes next. Keep it up to date when decisions change.

@docs/product-plan.md

## Working with the owner

- Saiff is not a programmer. Explain in plain language, keep replies short, avoid jargon.
- He makes every product decision. **Ask clarifying questions before building or
  detailing anything**; put choices as short questions with a recommendation.
- Show a design or screenshots before and after building screens.
- Commit and push after each finished piece. Work has been lost before to an unsaved
  session.
- He reads the app on a phone: check every screen at phone width (390 px).

## Branches

- `main` — mirrors upstream.
- `our-features` — PR #1 into `main` (installable app, footwear weather rules, sign-in
  email allow-list). Not merged yet.
- `stage-1` — PR #2 into `our-features`. **Current work happens here.**

Upstream remote: `https://github.com/Anyesh/wardrowbe`.

## Fork rules

- Put our code in **new files**; edit upstream files as little as possible so future
  upstream merges stay easy. Frontend additions live in `frontend/components/wardrobe/`
  and `frontend/lib/hooks/use-homes.ts`; backend in `backend/app/api/homes.py`,
  `backend/app/api/wardrobe_facets.py`, `backend/app/models/home.py`.
- Label reader: backend `backend/app/api/label_scan.py`,
  `backend/app/services/label_reader.py` (the AI instructions and answer parsing),
  `backend/app/services/label_photos.py`, `backend/app/models/label_photo.py`; frontend
  `frontend/components/wardrobe/label-*.tsx`, `frontend/lib/label-scan.ts`,
  `frontend/lib/hooks/use-label-scan.ts`.
- Automatic background removal on add: `backend/app/services/auto_background.py`, called
  from `ItemService.create`. Setting `AUTO_REMOVE_BACKGROUND` (default on; the test suite
  turns it off in `tests/conftest.py`). Needs `requirements-extras.txt` installed, which
  the Docker image already does.
- See-through cut-outs: `backend/app/utils/cutouts.py`. They are extra files beside an
  item's photo, found by name (`abc.jpg` → `abc_cut.webp`, `_cut_medium`, `_cut_thumb`),
  with no database column. `sign_image_url` swaps a photo for its cut-out, so every screen
  gets it without frontend changes; `ImageService` writes, rotates and deletes them with
  the photo. Anything that reads pixels (AI, duplicate check, split) uses the JPEG on
  white. On screens, put a clothes photo on the `photo-ground` CSS class, never on grey.
- Wardrobe categories: a two-level tree. The built-in tree and its rules are in
  `backend/app/utils/wardrobe_categories.py`; a person's own tree is one row in
  `wardrobe_category_trees` (`backend/app/services/wardrobe_category_service.py`,
  `backend/app/api/wardrobe_categories.py`). The frontend lists no categories itself: it
  reads `/wardrobe/categories` (`frontend/lib/hooks/use-wardrobe-categories.ts`) and
  translates built-in ones by key under `wardrobe.closet.categories`. A new garment type
  must be added to the built-in tree or a backend test fails.
- Phones have no top bar: `components/header.tsx` is desktop-only, and a page's own header
  shows `MobileMenuButton` (`components/wardrobe/mobile-menu.tsx`).
- Our database migrations form a chain: `b8e4d0f2a6c3_add_homes` hangs off upstream head
  `a7d3c9e1f5b2`, `c9f5e1a3b7d4_add_item_label_photos` hangs off that, and
  `d0a6f2b4c8e5_add_wardrobe_category_trees` off that. After merging
  upstream migrations, re-parent the first of ours onto the new head.
- `backend/tests/migration_helpers.py` has a `FORK_COLUMNS` list so upstream's
  migration tests still pass; add any new fork column on an upstream table there.
- Item details the user owns go in the `clothing_items.tags` JSON (`USER_TAG_KEYS` in
  `backend/app/schemas/item.py`) rather than new columns. `home_id` is a real column.
- Garment types come from `backend/app/data/garment_vocabulary.json`; after editing it
  run `npm run vocab:gen` in `frontend/` and add translations to every
  `frontend/messages/*/constants.json`.
- Every user-facing text needs a key in **all 8 languages** (`frontend/messages/`:
  en, de, fr, it, ja, ko, zh-CN, zh-TW). `npm run i18n:parity` must pass.
- "Wardrowbe" is upstream's brand. The app's own name is undecided; do not invent one.

## Stack

Backend: FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, Redis + arq workers.
Frontend: Next.js 14, TypeScript, Tailwind, shadcn/ui, next-intl, TanStack Query,
NextAuth, vitest.

## Running and testing

Needs PostgreSQL and Redis running locally.

Backend (from `backend/`, in a Python 3.13 virtualenv with `requirements.txt` + `ruff`; the
virtualenv's `bin` must be first on `PATH`, because the tests run `python -m alembic`):

```
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/wardrobe_test \
REDIS_URL=redis://localhost:6379/0 pytest
alembic upgrade head
DEBUG=true AI_INTERNAL_ENABLED=false STORAGE_PATH=/tmp/wstorage uvicorn app.main:app --port 8000
```

Frontend (from `frontend/`; use `npm install`, `npm ci` fails on the lockfile):

```
npx tsc --noEmit
npm test
npm run i18n:parity
NEXTAUTH_SECRET=devsecret NEXTAUTH_URL=http://localhost:3000 BACKEND_URL=http://localhost:8000 npx next dev -p 3000
```

With `DEBUG=true` the login page offers a dev login (no Google needed).

Known: `tests/test_recommendation_service.py::...test_entries_that_are_not_one_item_number_are_skipped`
fails on unmodified upstream too. It is not ours. Delete any stray `dump.rdb` before
committing.

## Commits

Plain descriptive messages saying what changed and why. Git identity is already Saiff's;
treat his email address as private.
