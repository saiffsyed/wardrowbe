# Product plan and decisions

Last updated: 16 November 2026. All points below were confirmed by Saiff unless marked
"open".

## What the app is

A private wardrobe for two people (plus at most 1–2 family members). "When I say wardrobe
it should be a wardrobe": the clothes come first, shown visually; planning and AI are
helpers. Simpler and more organised than upstream Wardrowbe.

Three main areas: **Wardrobe** (tabs Clothes / Outfits / Collections), **Outfits**,
**Plan**.

## Decisions

### Wardrobe
- Default grid is **bare cut-outs** (photo only). A switch offers photos with labels and
  a list ("database") view.
- Filters like a shopping site: occasion, colour, material, brand, season, status, not
  worn, used / not used in outfits. Plus sort and group-by.
- One filter row with a filter button; the first design was "a little too much".

### Item details (the database)
- Brand, size, size system, fit note, **where it was bought** (not where it was made),
  material mix with percentages, care, price / receipt.
- **Label photo reader**: photograph the tag, AI extracts the details, the user confirms.
  - Started from a "Scan label" button in Details, or as an optional step when adding an item.
  - One scan takes up to 3 photos (front, back, hang tag).
  - Nothing is saved until Confirm. If a detail is already filled in and the label differs,
    both are shown and the saved one is kept unless the label is picked.
  - The label photos are kept with the item, compressed (about 30–200 KB each), up to 6 per
    item, so a size or care symbol can be checked again later.
- **Details sit at the top of the item screen**, right under the photo and basic facts.

### Homes
- Clothes are spread over three homes: Europe, Chennai, Kadiri.
- **Each user adds their own homes and cities during setup.**
- The app shows only items in the home you are in, with an "all homes" switch.
- Location is set by hand. Weather follows the current home's city.

### Occasions
- Tags: wedding, work, casual, gym, festive, plus custom ones.
- Filter by occasion across homes and pack for a trip from that filter.
- Traditional wear and jewellery are first-class item types.

### Outfits
- Manual builder including shoes and jewellery. Three modes:
  1. **Collage** (default)
  2. **Dressing room**: mannequin outline, swipe to swap, lock, shuffle ("this feature is
     very good so let's keep this")
  3. **AI photo try-on**: both users are comfortable sending body photos to an AI
     service. No 3D avatar.

### Planning and suggestions
- AI suggestions using city weather, humidity and fair rotation of the wardrobe.
- Google Calendar sync and couple coordination.
- Week strip, day and month planner. Describe an occasion in your own words.

### Everyday features (all accepted)
Today card, quick swap, laundry / repair status, week strip, occasion sets, trip packing,
sizes by brand, "do I already own this?", wishlist, storage location, care instructions,
not-worn list, purchase record.

### Taken from the Fits app
Home rows ("Not yet worn", "Pairs you've never tried"), Insights screen with donut chart,
Find my colours, Rate my outfit, Display setting (light / dark / system; Saiff leans
dark), currency, "app starts in", AI stylist chat (model to be chosen later). Extra ways
to add items: **outfit photo first**, then product link, then receipts.

### Skip
Social feed, followers, OOTD stories, subscriptions / credits, catalogue search,
stickers, hairstyles, 3D avatar.

### Look
Agreed design: light ground **plain white** (`#FFFFFF`; Saiff did not like the grey-green
`#F3F4F1` showing around clothes photos) with accent `#1E5B4F`; dark ground `#121417` with
accent `#7FD6BC`; font Figtree. Design mock-ups:
https://claude.ai/artifact/JoQmJaArbh4N7Jy6dcstTH (private to Saiff).
- **Colours and font are applied** to the whole app (`frontend/app/globals.css`,
  `frontend/app/layout.tsx`). The app follows the phone's light / dark setting.
- **Display setting lives in Settings** (Same as phone / Light / Dark). Saiff did not want
  the light / dark button in the top bar, so it was removed from there.
- **The mock-up layout is not applied yet**: three-tab bottom bar, home switcher pill,
  category chips, details grouped in cards.
- Clothes photos should have their background removed automatically when an item is added
  (agreed). Measured at about half a second per photo on the build machine; the server
  will be slower. Not built yet.

## Build order

1. **Wardrobe** — in progress, see below
2. **Outfits** — collage, dressing room, Collections, laundry / repair
3. **Daily use** — home screen, planner, Calendar, couple coordination, suggestions
4. **AI try-on** — with a spending cap
5. **Extras** — add by outfit photo / link / receipt, packing, Insights, colours, rate my
   outfit, stylist chat

## Stage 1 status

Built and tested (backend + frontend, on branch `stage-1`):
- Homes: create, rename, delete, set current, move items; first home adopts existing
  items; switching home updates the weather city. Settings card and a home bar on the
  wardrobe page.
- New item details with in-place editing (`ClosetDetails` in the item dialog), shown at the
  top of the item screen.
- Label photo reader: reads brand, size, size system, material mix and care; review and
  confirm screen; kept label photos open large and can be deleted. Works with whichever AI
  provider is configured. **Only tested with a stand-in AI so far, not with real label
  photos and a real provider.**
- Filters by home, occasion, brand, material, season, with counts
  (`GET /wardrobe/facets`); sort by brand and price.
- Three views: cut-outs, tiles, list.
- New garment types: ring, necklace, earrings, bracelet, bangles, cufflinks, kurta,
  sherwani, saree, lehenga, salwar-kameez, dupatta, dhoti, mojari.

Still to do in Stage 1:
- Try the label reader on real labels once an AI provider is chosen, and tune its
  instructions if it misreads
- Apply the mock-up layout (colours, font and the Display setting are done); currency,
  "app starts in"
- Remove photo backgrounds automatically when an item is added
- Wardrobe tabs Clothes / Outfits / Collections
- Group-by, "used in outfits" filter, colour and status filters in the filter row
- "Move to home" in the multi-select toolbar
- Simplify the menu (hide stats, pairings, family feed)
- Homes setup during first-run onboarding; photo tip on the add-item screen
- Settings page runs ~4 px wider than a phone screen (upstream bug)

## Open questions for Saiff

- In dark mode, should clothes float on the dark ground (needs see-through cut-outs) or
  stay on white squares?
- AI provider: OpenAI or Gemini (the label reader works with either)
- App name and domain (a domain is needed for Google sign-in)
- Confirm the starter list of traditional garments
- Merge PR #1, then PR #2

## Going online (agreed, not ordered)

- Server: netcup VPS 1000 G12 (8 GB RAM, about €10 / month — check the current price).
  It can also host future test apps.
- Google sign-in with an email allow-list (`OIDC_ALLOWED_EMAILS`), see
  `docs/google-sign-in.md`. Set the Google project to **"In production"**: in "Testing"
  mode Calendar access expires every 7 days. That doc still needs this note added.
- Before going online: update frontend packages for security fixes (Next.js etc.), set up
  backups and a test copy, estimate AI running costs.
