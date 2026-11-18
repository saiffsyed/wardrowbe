# Product plan and decisions

Last updated: 17 November 2026. All points below were confirmed by Saiff unless marked
"open".

## What the app is

A private wardrobe for two people (plus at most 1–2 family members). "When I say wardrobe
it should be a wardrobe": the clothes come first, shown visually; planning and AI are
helpers. Simpler and more organised than upstream Wardrowbe.

Three main areas: **Wardrobe** (tabs Clothes / Lookbook / Collections), **Outfits**,
**Plan**.

## Decisions

### Wardrobe
- Default grid is **bare cut-outs** (photo only). A switch offers photos with labels and
  a list ("database") view.
- Filters like a shopping site: occasion, colour, material, brand, season, status, not
  worn, used / not used in outfits. Plus sort and group-by.
- One filter row with a filter button; the first design was "a little too much".
- **Filter panel** (built): kind, group by, colour, occasion, brand, material, season,
  worn (never / not in 3 months), outfits (in one / in none), needs wash, favourites.
  **Group by** kind, colour, home or brand shows a heading with a count over each group;
  sort is switched off while grouping. Grouping works page by page (20 items by
  default), so a large group can continue on the next page.

- **Wardrobe tabs Clothes / Lookbook / Collections** (built and approved).
  - Lookbook: saved looks (outfits kept to wear again, not tied to a day), two per row.
    Each look is laid out as it is worn, like the Fits app: head jewellery at the top, then
    top, bottom and shoes; a saree, lehenga or dress fills top and bottom; dupatta, bag and
    bangles in a column beside. White tile with a thin border (faint tile in dark mode),
    name and occasion underneath. Outfits inside a collection use the same tile. The top
    and the bottom touch, with no gap, like an outfit laid flat; jewellery and shoes are
    drawn a little narrower. A long top (kurta, kurti, sherwani) lies over the upper part of
    the bottoms, which show from under its hem.
  - **Agreed for Stage 2:** the look you arrange is the look that is saved. The outfit
    maker's collage board starts from this automatic layout; you drag pieces, resize them
    and tap Front / Back to choose which lies over which. The positions are saved with the
    look, and the Lookbook and Collections show it exactly so. Looks never arranged by hand
    (older ones, the app's suggestions) keep the automatic layout.
    The bottom-bar Outfits tab becomes the outfit maker in Stage 2.
  - Collections: named sets holding clothes and outfits together ("Wedding season").
    Card with a 2×2 picture collage, name and count. Add from an item's ⋯ menu or the
    "Add to collection" button on an outfit; take things out with Edit on the collection.
  - Collections are private for now; a "share with family" switch can come later.

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
- **Move to home** (built): select items in the wardrobe, tap Move (a pin icon on a phone)
  and pick a home. Works for "select all" too. Only offered once there are two homes.
- **First-run setup asks for homes** (built): the original Location step became "Where do
  you keep your clothes?". The first home added becomes the current one and sets the
  weather city. It can be skipped. New accounts no longer see a "Location not set" alert.

### Occasions
- Tags: wedding, work, casual, gym, festive, plus custom ones.
- Filter by occasion across homes and pack for a trip from that filter.
- Traditional wear and jewellery are first-class item types.

### Outfits
- Manual builder including shoes and jewellery. Three modes:
  1. **Collage** (default): free arranging on a board, saved with the look (see Lookbook)
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
- **Wardrobe screen follows the mock-up** (built): one row with the home pill and round
  filter / search / add buttons; the Clothes / Lookbook / Collections switch;
  category chips; sort and views; search opens from its button.
- **Top row like the Fits app** (preview): logo and app name on the left, the home with
  its weather in the middle ("Chennai | ☀ 31°", tap to switch home), round buttons on the
  right (Clothes: filter, search, +; Lookbook and Collections: +). Same row on all three
  wardrobe tabs. The logo is a stand-in hanger and the name reads "Name" until Saiff picks
  one (four letters at most); both live in `frontend/lib/app-name.ts` and
  `components/wardrobe/app-top-bar.tsx`. **No "Wardrobe" title and no counts** on the
  three tabs (Saiff: the name is in the top row and "Wardrobe" on the bottom bar); the
  title is kept only for screen readers.
- **The top folds away while scrolling** (preview; Saiff chose this from three ideas,
  https://claude.ai/artifact/Vqxrv43ywELFBSKPfGkKTJ): on a phone, scrolling down leaves only
  the top row (home, weather, filter, search, add) stuck to the screen; scrolling up slides
  the rest back over the clothes. Short pages do not fold. **This home / All homes moved
  into the filter panel** ("Homes"); choosing All homes counts on the filter button and
  shows as a small "All homes" line under the top row.
- **Phones have no top bar and no side menu.** Saiff did not like the side menu and
  chose a More tab like the Fits app's. Laptops keep their side menu.
- **Bottom bar: Wardrobe / Outfits / Plan / More**, no centre button (adding an item is the
  green + on the wardrobe screen). Plan opens the old Dashboard screen until the Plan area
  is built; it also holds the "suggest an outfit" button.
- **More screen**: name and email at the top (opens Account), tiles for Insights, History
  and Family, and a settings list whose rows each open a screen: Homes, Categories,
  Display, Style & weather preferences (the original settings page), Notifications,
  Account (language, sign-out). Screens opened from More have a "‹ More" back button.
  Pairings, AI Learning and Family Feed are not offered on a phone.
- **Categories are grouped and each person can edit them** (built and approved). Saiff asked for categories that suit an Indian woman's
  wardrobe, "grouped, but sensible", with editing in Settings like the Fits app's
  "Manage tags".
  - Main chips: All · Indian wear · Western wear · Shoes · Jewellery · Accessories.
    Tapping one opens a second row: Indian wear → Sarees · Kurtas & suits · Lehengas ·
    Dupattas & stoles · Bottoms; Jewellery → Necklaces · Earrings · Bangles & bracelets ·
    Rings · Hair & head · Anklets & toe rings · Waist belts · Watches; and so on.
  - A group or sub-group with no items is not shown, so each person's bar matches what
    they own. This replaced the idea of separate men's and women's sub-groups: a kurta and
    a sherwani are both under "Kurtas & suits".
  - Settings → Categories: rename, add and delete groups and sub-groups, choose which
    kinds of item each sub-group holds, and go back to the standard set. Each person has
    their own arrangement.
  - **Your own kinds of item** (built): Settings → Categories → "Add a kind of item" takes a
    name ("Pattu pavadai") and the built-in kind it is closest to (Lehenga). It then
    appears in the type list when adding or editing an item, and can be ticked into any
    category. An item of that kind is stored as the built-in type plus the name as its
    subtype, so outfits, washing and weather rules treat it like the built-in type.
    Deleting a kind leaves its items as they are.
- **Item screen follows the mock-up's cards** (built): top row is the name, heart, Edit
  and a "⋯" menu naming every other action; one line with colour, kind and wear count;
  Kept in and Status tiles, occasion chips, a Details card (brand, size, fit note, bought
  in, bought on, price), Material, Care, Wash status, Wear history, AI analysis and Notes
  as labelled cards.
- **Price currency is per item** (Saiff agreed): clothes are bought in India and Europe,
  so each price keeps its own currency (INR, EUR, GBP, USD, AED, CHF, SGD; stored in
  the item's tags as `currency`). The last one used is offered next. No app-wide
  currency setting.
- **Clothes photos have their background removed automatically when an item is added**
  (built). The cleaned photo is saved on white; the untouched photo is kept, so the
  existing "undo background removal" button brings it back. If removal fails the item is
  still added with the photo as taken. Adding one photo took about 1.4 seconds on the
  build machine (the server will be slower); the very first photo after the server
  starts took about 19 seconds there while the removal tool loaded.
- **See-through cut-outs** (built; Saiff chose this because the dressing room and collage
  need clothes that can be stacked). When a background is removed the app keeps two
  copies: the photo on white (read by the AI and the image tools) and a see-through
  cut-out, which is what every screen shows. In light mode clothes sit on the white page;
  in dark mode they sit on a faint lighter tile so black and navy clothes stay visible.
- **Cut-outs are trimmed to the garment's edges** (built; Saiff agreed) with a thin margin,
  so clothes fill their wardrobe tiles and a shirt sits right on the trousers in a look.
  Cut-outs made before this are trimmed by `python -m scripts.make_cutouts --trim`.

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
- Agreed colours and Figtree font across the app; Display setting in Settings; automatic
  background removal with see-through cut-outs for newly added photos. Items whose
  background was removed earlier get cut-outs from `python -m scripts.make_cutouts`.
- Indian women's wear types: kurti, anarkali, half-saree, sharara, saree blouse,
  petticoat, churidar, palazzo, patiala, stole, juttis, kolhapuris, jhumkas, maang tikka,
  nose ring, anklets, toe rings, waist belt, mangalsutra, hair jewellery, clutch, potli.
- **Weather in the home button** (preview): the wardrobe's home button shows the current
  home's temperature and a sky icon ("Chennai · 31°C ☀"). The full weather card stays on
  Plan and becomes part of the Stage 3 "Today" card.
- **"App starts in"** (preview): More → Display offers Wardrobe (default), Lookbook,
  Outfits or Plan; kept with the account. The installed app and a fresh sign-in open
  `/dashboard/start`, which goes on to the chosen screen.
- Photo tip on the add-item screen (single and bulk): one line, "More tips" opens four
  points (flat or hung on a plain wall, daylight, whole piece and one per photo, saree
  folded with border and pallu showing, jewellery on a plain surface).
- New garment types: ring, necklace, earrings, bracelet, bangles, cufflinks, kurta,
  sherwani, saree, lehenga, salwar-kameez, dupatta, dhoti, mojari.

Still to do in Stage 1:
- Try the label reader on real labels once an AI provider is chosen, and tune its
  instructions if it misreads
- Split "Style & weather preferences" (the original settings page) into clearer screens
- Settings page runs ~4 px wider than a phone screen (upstream bug)

## Open questions for Saiff

- Grouped categories: does the grouping make sense to his partner?
- AI provider: OpenAI or Gemini (the label reader works with either)
- App name (four letters at most, Saiff will choose), logo, and domain (a domain is
  needed for Google sign-in)
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
