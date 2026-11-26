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
- See-through cut-outs: `backend/app/utils/cutouts.py`, trimmed to the garment's edges
  (`trim`). They are extra files beside an
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
- A person's own kinds of item: `wardrobe_custom_kinds` (`backend/app/models/wardrobe_kind.py`),
  endpoints `/wardrobe/kinds` in `backend/app/api/wardrobe_categories.py`. An item of one
  is stored as its built-in `type` plus the kind's name as `subtype`; category filtering
  matches on both (`CategoryFilter` in `backend/app/utils/wardrobe_categories.py`).
- Phones have no top bar and no side menu: `components/header.tsx` and the sidebar are
  desktop-only. The phone bottom bar ends in a More tab (`components/wardrobe/more-screen.tsx`,
  routes under `app/dashboard/more/`); screens listed in `frontend/lib/more-routes.ts` get a
  back-to-More button on phones. `mobile-sidebar.tsx` and `mobile-menu.tsx` are unused.
- Our database migrations form a chain: `b8e4d0f2a6c3_add_homes` hangs off upstream head
  `a7d3c9e1f5b2`, `c9f5e1a3b7d4_add_item_label_photos` hangs off that, and
  `d0a6f2b4c8e5_add_wardrobe_category_trees` off that, and
  `e1b7a3c5d9f6_add_wardrobe_custom_kinds` off that, and `f2c8b4d6e0a7_add_collections`
  off that, and `a3d9f5b1c7e8_add_start_screen` off that, and `b4e0a6c2d8f9_add_stays` off
  that, and `c5f1b7d3e9a0_add_outfit_layouts` off that, and
  `d6a2c8e4f0b1_add_dressing_room_settings` off that, and `e7b3d9f5a1c2_add_item_laundry` off
  that, and `f8c4e0a6b2d3_add_couple_settings` off that. After merging
  upstream migrations, re-parent the first of ours onto the new head.
- Wardrobe tabs and collections: tab switch `frontend/components/wardrobe/wardrobe-tabs.tsx`
  (URL `?tab=lookbook|collections`, read in `app/dashboard/wardrobe/page.tsx`),
  `lookbook-tab.tsx`, `collections-tab.tsx`, `collection-screen.tsx` (route
  `app/dashboard/wardrobe/collections/[id]`), `add-to-collection.tsx`,
  `lib/hooks/use-collections.ts`; backend `backend/app/api/collections.py`,
  `backend/app/models/collection.py`.
- `backend/tests/migration_helpers.py` has a `FORK_COLUMNS` list (table, column, SQL type)
  so upstream's migration tests still pass; add any new fork column on an upstream table
  there. `user_preferences.start_screen` is one ("App starts in", `lib/start-screen.ts`,
  `components/wardrobe/start-screen-settings.tsx`, route `app/dashboard/start`).
- Weather bar under the wardrobe's top row: `components/wardrobe/weather-bar.tsx` (sky
  icons in `home-weather.tsx`).
- Stays and day-by-day weather: backend `backend/app/api/stays.py` (`/stays`,
  `GET /weather/days`, `POST /weather/days/{day}/outfit`), `backend/app/models/stay.py`;
  frontend `components/wardrobe/weather-screen.tsx` (route `app/dashboard/weather`),
  `weather-sheet.tsx`, `add-stay-dialog.tsx`, `stay-home-prompt.tsx`,
  `lib/hooks/use-stays.ts`, clothes hints `lib/weather-hints.ts`.
- Planner (the Plan tab, route `app/dashboard/plan`): `components/wardrobe/planner-screen.tsx`
  (Day and Month, URL `?view=month&day=YYYY-MM-DD`), `add-outfit-sheet.tsx`. The bottom
  bar and "App starts in" point Plan there; upstream's `/dashboard` page is left as it was.
  On today the Day view adds Swap / I wore it, or the empty-day tiles
  (`components/wardrobe/today-card.tsx`; which saved looks Swap offers: `lib/today.ts`;
  the stages of "I wore it" — Undo window, sending, sent — in `lib/today-wear.ts`).
- Heads-ups on the Plan screen: rules in `frontend/lib/heads-ups.ts` (tested in
  `tests/heads-ups.test.ts`), the line in `components/wardrobe/heads-ups.tsx`, the home before
  a trip in `lib/trip-return.ts` (localStorage, written by `stay-home-prompt.tsx`).
- Partner (couple coordination): backend `backend/app/api/couple.py` (`GET/PATCH /couple`,
  `GET /couple/plans`; partner = the chosen family member, or the other one of two),
  `backend/app/models/couple.py`; frontend `lib/hooks/use-couple.ts`,
  `components/wardrobe/partner-look.tsx` (corner tile, eye, large view, settings card on the
  upstream Family page, Match with partner); matching rules `lib/partner-match.ts`, Wada colour
  pairs `lib/wada.ts` with data `lib/data/wada-colors.json` (MIT, see `WADA-LICENSE.md`).
- A look's stage (template = Lookbook, planned, worn, declined) is named in
  `frontend/lib/look-phase.ts`, which also picks the look shown for a day (`lookForDay`). The
  server refuses to mark a Lookbook look worn (409 `OUTFIT_IS_TEMPLATE`, our guard in the
  feedback endpoint); it is worn through a dated copy (wear-today).
- Outfit maker (the Outfits tab, route `app/dashboard/outfits/make`, `?date=` to plan a day,
  `?edit=` to rearrange a look): `components/wardrobe/outfit-maker.tsx`, the board in
  `outfit-board.tsx`, starting layout in `lib/board-layout.ts`. Saved arrangements: backend
  `backend/app/api/outfit_layouts.py`, `backend/app/models/outfit_layout.py`; frontend
  `lib/hooks/use-outfit-layouts.ts`, shown by `LookTile`'s `arranged` prop.
  Its modes are written at the top of `OutfitMaker`: a new look (Lookbook, or a day with
  `?date=`) or an edit (`?edit=`, loaded once, keeps its day; a worn look only saves as new).
  Editing can change the occasion (our `occasion` field on upstream's PATCH /outfits/{id}).
- Dressing room (step `dress` of the outfit maker): `components/wardrobe/dressing-room.tsx`,
  the figure `dressing-figure.tsx`, places, sizes and Shuffle's rules in `lib/dressing-room.ts`
  (tested in `tests/dressing-room.test.ts`). Settings (figure, background, figure colour):
  backend `backend/app/api/dressing_room.py`, `backend/app/models/dressing_room.py`; frontend
  `lib/hooks/use-dressing-room.ts`, `components/wardrobe/dressing-room-settings.tsx`, route
  `app/dashboard/more/dressing-room`.
- Laundry: clothes away in the wash or at the dry cleaner are rows in `item_laundry`
  (`backend/app/models/laundry.py`, with `away_item_ids` used by the recommendation service;
  API `backend/app/api/laundry.py`: `GET /laundry`, `/laundry/states`, `POST /laundry/move`).
  "Needs washing" stays upstream's `needs_wash`. **Every change goes through
  `backend/app/services/laundry_service.py`**: the four states (clean / dirty / washing /
  dry_cleaning), the moves each allows, and the hooks upstream calls (archive forgets the row,
  a wear of a piece marked away records its wash first, "Mark washed" returns it). The app
  side mirrors the table in `frontend/lib/laundry.ts`. Frontend `lib/hooks/use-laundry.ts`,
  `components/wardrobe/laundry.tsx` (badge, ⋯ menu entries, More count),
  `laundry-screen.tsx`, route `app/dashboard/more/laundry`.
- Item details the user owns go in the `clothing_items.tags` JSON (`USER_TAG_KEYS` in
  `backend/app/schemas/item.py`) rather than new columns. `home_id` is a real column.
- Garment types come from `backend/app/data/garment_vocabulary.json`; after editing it
  run `npm run vocab:gen` in `frontend/` and add translations to every
  `frontend/messages/*/constants.json`.
- Every user-facing text needs a key in **all 8 languages** (`frontend/messages/`:
  en, de, fr, it, ja, ko, zh-CN, zh-TW). `npm run i18n:parity` must pass.
- "Wardrowbe" is upstream's brand. **The app is called plain "Wardrobe"** (Saiff and his
  partner, 26 Nov 2026; it replaced "Aina"; domain mywardrobe.fit; line "Wear more of what you
  own"). The top bar shows **only the logo** (the name is there for screen readers), since
  "Wardrobe" is already on the bottom bar. The name lives in `frontend/lib/app-name.ts`,
  `app/layout.tsx` (page title), `app/manifest.ts` (installed app) and the `brandName` /
  `brandAlt` / `greeting` / invitation keys in `messages/*`. **Logo** (chosen 25 Nov): an arch mirror with a person reflected in it, her
  A-line dress the letter A; drawn in `components/wardrobe/aina-logo.tsx` (`AinaMark`, top
  bar), `public/logo.svg` and the PNG icons / `favicon.ico` in `public/` (white on the green
  `#1E5B4F` tile; regenerate all of them together if the drawing changes).

## Our server

netcup VPS (Debian 13), IP 62.83.136.19, logged into as root with Saiff's SSH key only
(passwords off, firewall `ufw` allowing SSH, 80, 443, automatic security updates). The app
lives in `/opt/aina`, a clone of `stage-1` made with a read-only GitHub deploy key.
`deploy/install.sh` installs or updates it: it writes `.env` once (random passwords), pulls,
builds our own images through `deploy/docker-compose.aina.yml` on top of upstream's
`docker-compose.prod.yml`, and migrates. Test phase: nginx listens on 127.0.0.1:8080 only,
opened through an SSH tunnel (`ssh -L 8080:localhost:8080 root@…`) at **http://127.0.0.1:8080**
(Saiff's browsers force https on "localhost"), with dev login (`DEBUG` / `DEV_MODE`) and no
AI. After containers are recreated, nginx must be restarted (it keeps old addresses → 502);
`install.sh` does it. The domain mywardrobe.fit points at the server (A records `@` and `www`
at Namecheap). **Going public:** `deploy/go-live.sh` asks for the Google client, the allowed
addresses and (to keep test data) the test login's email, which it re-points at a Google
address and marks verified so Google sign-in joins that account; it writes DOMAIN, https
URLs, OIDC settings, `TRUSTED_PROXY_COUNT=2` and turns DEBUG / DEV_MODE off. With `DOMAIN` set,
`install.sh` adds `deploy/docker-compose.https.yml` (Caddy on 80/443, `deploy/Caddyfile`,
automatic certificates) and refuses while the test login is on.
**Automatic updates** (Saiff's choice): every push to `stage-1` runs
`.github/workflows/deploy-our-server.yml`, which logs into the server with the key in the
`DEPLOY_SSH_KEY` secret (host key in `DEPLOY_KNOWN_HOSTS`). That key is a forced command in
root's `authorized_keys`: it can only run `deploy/install.sh`. So **push to stage-1 only after
Saiff confirms**: it goes live on both phones within minutes.

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
