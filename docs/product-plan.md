# Product plan and decisions

Last updated: 25 November 2026. All points below were confirmed by Saiff unless marked
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
- **Outfit maker, Collage** (built, preview; Saiff chose the Fits flow, mock-up
  https://claude.ai/artifact/3ZjKuDL5gcs28nqxLL3CBB): the Outfits tab opens
  `/dashboard/outfits/make`.
  - **Step 1, pick**: Suggestions and From Lookbook tiles, the category chips of the current
    home, a grid of clothes with a tick each, and at the bottom "N selected" with the small
    pieces (✕ to take out), a Collage switch (Dressing room comes next) and Next.
  - **Step 2, arrange** on a plain white board: pieces start in the automatic layout; drag
    to move, pinch with two fingers (or the mouse wheel) to resize, tap for Front / Back /
    Remove. Bottom: Add clothes (the picker as a sheet), Background (white, cream, light
    grey, black), Switch mode. No stickers.
  - **Step 3, save**: name, occasion, then Save to Lookbook, or Save and plan for a day
    (also reached from the Planner's "Make a new one", which brings the day).
  - The arrangement is saved with the look (`outfit_layouts`); the Lookbook, Collections
    and Planner show it exactly so, with the chosen background filling the tile. An
    outfit's own screen has **Arrange**, which reopens it on the board; saving then updates
    the same look, with "Save as a new look" beside it.
- **Dressing room** (built, preview; mock-up https://claude.ai/artifact/RJEX49EG7zsqTqqKSZhdL8,
  calm like the Fits app): reached from the maker's Collage ⇅ switch or Switch mode on the
  board. Only the outfit shows on a plain figure until a piece is tapped; then the pieces
  beside it peek in from the edges to swipe through, ✓ / 🔒 / shuffle this / remove appear on
  the side and a sheet of that place's clothes (chips by kind) opens at the bottom. Places:
  head jewellery, necklace, top (a saree, lehenga or dress also covers the bottom), a jacket
  or coat over the top (no shawls), bottom, shoes, and dupatta, bangles and bag each in their
  own place. Bottom buttons: Clothes (add anything, by group), Occasion, Shuffle (with Undo
  for 5 seconds), Switch mode. Shuffle keeps locked places, follows the occasion, leaves out
  warm clothes on a hot day (28° and up) and adds a warm layer on a cold one (14° and below),
  and prefers clothes not worn for longest; fixed rules, no AI. Only clothes in the current
  home that are not waiting for a wash. Pieces are sized by kind. Next goes to the same Save
  screen (the look keeps the automatic layout). **More → Dressing room**: women's or men's
  figure, background and figure colour, each person their own.
- **Laundry** (built, preview; mock-up https://claude.ai/artifact/SKEE6VBYQreWi2uuppGPNF):
  a Laundry tile on the More screen with a count opens three tabs, **To wash** (upstream's
  automatic "needs washing" after a set number of wears), **In the wash** and **Dry cleaner**,
  for the clothes of the current home. Tick clothes (or Select all) and tap Washing now / Dry
  cleaner, later Back in the wardrobe, which also records a wash (method "dry_clean" from
  the dry cleaner). Clothes that are away stay in the wardrobe, faded, with a badge; the
  item's Status tile shows it and its ⋯ menu has Put in the wash / Send to the dry cleaner /
  Back in the wardrobe. The Dressing room, Shuffle and outfit suggestions leave them out;
  the item's own "Mark washed" also brings it back. No tailor / repair status (Saiff
  decided against it). Reminders are left for Stage 3.
  **Rules (Saiff agreed, 21 Nov):** archiving a piece that is in the wash or at the dry
  cleaner takes it out of the laundry without recording a wash (restored, it comes back as it
  was before, "needs washing" if it was dirty). Wearing a piece marked away counts it as
  washed and back, never blocks; "I wore it" then says so ("Teal kurti was marked in the
  wash — now back in your wardrobe"). A Today line for a planned look whose piece went to
  the wash ("… is in the wash · Swap") comes with the heads-ups.
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

- **Weather screen** (built, preview; mock-up https://claude.ai/artifact/6hmbyaHbJpYufKwwjrUgYC): opens from the weather bar. Today (temperature, feels like, "while
  you're out" range, rain, humidity, UV, a clothes hint, today's planned look); the next
  7 days, each with high / low, rain, humidity, a clothes hint worked out by fixed rules
  (no AI cost) and "Plan outfit" (suggests a look for that day's weather and saves it to
  that day, with a chance to swap first) or the planned look's tile. Later (Stage 3):
  heads-ups such as rain against a planned outfit, laundry before rainy days, the weather
  at another home before a trip.
- **Stays: "Where I'll be"** (built, preview): added in **Plan** (Saiff's choice), on
  a stays row under the week. A stay is a city and from / to dates; your homes are
  offered first, any other city by search. Days without a stay use the current home's
  city. The weather screen, the weather bar and outfit suggestions use each day's city
  (those days marked "📍 Bangalore"). A stay at one of your homes does not switch the
  wardrobe by itself; that morning a one-tap question asks "You're in Europe today. Show
  the clothes kept there?". Stays beyond the 16-day forecast show "Forecast from …".
  Plan itself is rebuilt in Stage 3; only the stays row is added to it now (tap a day or
  "I'll be elsewhere"; ✕ on a stay removes it). The weather screen also has "Add a stay".
  Not done yet: the "while you're out" hour range (today shows low → high instead), and
  swapping a planned outfit before it is saved (it is saved, then opens like any outfit).

- **Planner** (built, preview; Saiff loves the Fits planner, mock-up
  https://claude.ai/artifact/Q6eBjbMncAw1NGrBWEddPz): the Plan tab is now
  `/dashboard/plan`, titled Planner, with a Today button and Day / Month tabs.
  - **Day**: week strip (Sunday first, ‹ › for other weeks) with a tiny weather icon under
    each date the forecast reaches, a dot on days with an outfit and a purple line on
    days away; one weather line for the chosen day ("☀ 33° Sunny · 26–33° · rain 10% ›");
    no "suggestions waiting" card (Saiff did not want it); the day's
    look in a big card (swipe for the next or previous day) or **+ Add outfit**, which
    offers Suggest for the weather / Pick from Lookbook / Make a new one; under it
    "You'll be in Chennai · Change".
  - **Month**: the whole month like Fits, each day a look thumbnail or +, weather icons
    as far as the forecast reaches, a purple line under days of a stay; tap a day to open
    it in Day.
  - **Tapping the weather** (the line, or the wardrobe's weather bar) opens a sheet:
    temperature, low to high, rain, humidity, UV, wind, the clothes hint, "Suggest an
    outfit for this weather", "I'll be somewhere else this day" (or "Remove the stay"),
    and "See the next 7 days" (the weather screen).
  - **Calmer Plan screen** (built, preview; Saiff found the top too busy, mock-up
    https://claude.ai/artifact/W8zi4eSJsLuKu6aeLGN1Qj): one header line with the day
    ("Today", "Tomorrow" or the weekday) and its date (plus "Back to today"), a small weather
    button ("☀ 31°": the temperature now for today, the high for other days) that opens the
    weather sheet, and a calendar button for Month. No "Planner" title, no Day / Month tabs,
    no weather icons under the dates and no "You'll be in …" line (the sheet has the city and
    "I'll be somewhere else this day"). The week is one slim row with one-letter days. The
    look has no box and fills the rest of the screen; swipe it for the next or previous day.
  - **Today** (built, preview; mock-up https://claude.ai/artifact/Fx7wWQDZpcSnszFzFUUet5):
    under today's look, its name and occasion, **Swap** and **I wore it**. Swap offers three
    saved looks that suit the weather (every piece in this home, none to wash or away,
    nothing warm on a hot day, warm looks first on a cold one, least recently worn first),
    "More from Lookbook", "New suggestion" and "Make a new one"; the chosen look replaces
    today's plan. I wore it counts the wears after a 5-second Undo. With nothing planned: two
    equal tiles, Suggest for the weather and Pick from Lookbook (Saiff wanted both to share
    the focus), and a smaller "Make a new one". **Every empty day** shows the same two tiles
    (Saiff agreed); past the 16-day forecast only Pick from Lookbook and Make a new one. Heads-ups come next (Stage 3, step 2), then
    couple coordination; Google Calendar waits until the app is online.
  - **Heads-ups** (built, preview; mock-up https://claude.ai/artifact/GjwHsF3mQvJcqtZrEA3svu):
    one short line under the week, only when something needs you, with one action and ✕
    (hides it for that day); the most important shows, "+N more" opens the rest; the look
    shrinks a little to keep Swap / I wore it on screen. Fixed rules, no AI, no phone
    notifications yet. In order: a piece of the day's look is in the wash / at the dry
    cleaner / needs washing (Swap); rain 60%+ against suede, silk, velvet or leather (Swap);
    wool or a coat on a hot day, or no warm layer on a cold one (Swap); and on today only, a
    stay within 3 days 8°+ colder or warmer (See weather), back from a trip (Yes: shows the
    clothes of the home you were in before it, remembered on this phone when the arrival
    prompt switched the wardrobe), and rain 3 days running ahead with 5+ pieces to wash
    (Laundry). On other days Swap reads "Change" and opens the look in the outfit maker.
  - **Partner's look** (built, preview; mock-up https://claude.ai/artifact/TjEk8tFap74AbdWy14nqhE):
    with a partner in your family (More → Family; with more than two members you pick
    who), their look for the day sits small in the top-right corner of the Plan screen, a
    pink dot in the week marks days they planned, and "Partner · nothing yet" shows when
    they have none. An **eye** button under it hides / shows it (remembered on the phone);
    tapping the tile opens their look large. Sharing planned looks is **on by default** and
    goes both ways; More → Family → Partner has the "Share my planned looks" switch. Only
    looks planned on days are shared, never the wardrobe. The **eye sits on the tile's corner**
    (Saiff asked to move it there).
  - **Match with partner** (built, preview): in the partner's large view. **Go with** (default)
    or **Twin**; up to three saved looks plus one **new look** put together from your clothes,
    each with a short reason and, for colour pairs, the Wada combination's swatches. Picking
    one plans it for that day (replacing your plan; not after you wore one). Rules
    (`frontend/lib/partner-match.ts`): same occasion or kind of day; colours after **Sanzo
    Wada's "A Dictionary of Color Combinations"** (Saiff's reference; data from
    github.com/mattdesl/dictionary-of-colour-combinations, MIT, in `frontend/lib/data`):
    each of the app's 20 colour names stands for up to six nearby Wada shades, and two colours
    go together as often as Wada combined those shades; colours he never combines are never
    offered; neutrals go with anything; one patterned and one plain; Indian wear together
    preferred; only clean clothes in this home that suit the weather. No AI suggestion here
    yet: the AI service cannot see the partner's look.
  - The original app's home screen is still at `/dashboard` (laptop side menu) but is no
    longer the Plan tab; its "Where I'll be" row was removed. Its weekly stats are on
    Insights under More.

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
- **Top row like the Fits app** (preview): logo and app name on the left, the home in the
  middle ("📍 Chennai ▾", tap to switch home), round buttons on the
  right (Clothes: filter, search, +; Lookbook and Collections: +). Same row on all three
  wardrobe tabs. The logo is a stand-in hanger and the name reads "Name" until Saiff picks
  one (four letters at most); both live in `frontend/lib/app-name.ts` and
  `components/wardrobe/app-top-bar.tsx`. **No "Wardrobe" title and no counts** on the
  three tabs (Saiff: the name is in the top row and "Wardrobe" on the bottom bar); the
  title is kept only for screen readers.
- **Weather bar** (preview; Saiff asked for it where the title was): under the top row,
  "☀ 31° Sunny · feels like 35° / Rain 10% · Humidity 70%". It folds away with the tabs
  while scrolling and opens the weather screen. On a day away it shows the stay's city. On all three wardrobe tabs.
  `components/wardrobe/weather-bar.tsx`.
- **The top folds away while scrolling** (preview; Saiff chose this from three ideas,
  https://claude.ai/artifact/Vqxrv43ywELFBSKPfGkKTJ): on a phone, scrolling down leaves only
  the top row (home, weather, filter, search, add) stuck to the screen; scrolling up slides
  the rest back over the clothes. Short pages do not fold. **This home / All homes moved
  into the filter panel** ("Homes"); choosing All homes counts on the filter button and
  shows as a small "All homes" line under the top row.
- **Phones have no top bar and no side menu.** Saiff did not like the side menu and
  chose a More tab like the Fits app's. Laptops keep their side menu.
- **Bottom bar: Wardrobe / Outfits / Plan / More**, no centre button (adding an item is the
  green + on the wardrobe screen). Plan opens the Planner.
- **More screen**: name and email at the top (opens Account), tiles for Insights, History
  and Family, and a settings list whose rows each open a screen: Homes, Categories,
  Display, My style, Body & fit, Weather comfort, Suggestions, Notifications, Account
  (language, sign-out). The middle four (preview) are the original settings page shown
  one part at a time (`/dashboard/settings?section=style|body|weather|suggestions`), each
  with its own Save; its Account and Location parts are left out (Account and Homes
  replace them) and the AI service setup shows only on the full page on a laptop. The
  settings page no longer runs wider than a phone screen. Screens opened from More have a "‹ More" back button.
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
2. **Outfits** — collage, dressing room, Collections, laundry (done)
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
- **Weather** (preview): a weather bar under the wardrobe's top row (see Look). The full
  weather card stays on Plan and becomes part of the Stage 3 "Today" card.
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

## Open questions for Saiff

- Grouped categories: does the grouping make sense to his partner?
- AI provider: OpenAI or Gemini (the label reader works with either)
- App name: **Aina** ("mirror") is the favourite, to be confirmed; logo still open
- Confirm the starter list of traditional garments
- Merge PR #1, then PR #2

## Going online

- **The app's idea, in one line: "Wear more of what you own."** It started from owning
  clothes that are rarely worn; the wardrobe, Shuffle, suggestions and "not worn" filters
  all serve it.
- Domain: **myaina.fit** (Saiff's choice, 25 Nov; to be bought at Namecheap:
  privacy on, no extras, auto-renew on).
- Server: **netcup VPS 500 G12.5** (2 cores, 4 GB RAM, 64 GB; €9.74 / month incl. VAT)
  on the **monthly** term first, to test for a month or two before a 12-month contract
  (€8.47 / month). Enough for this app; upgrading to VPS 1000 G12.5 later is free but
  restarts the 12-month term, and only works within the same generation. Ubuntu 24.04,
  IPv4 + IPv6. Set up from Saiff's Windows computer (Terminal), with copy-paste steps.
- Google sign-in with an email allow-list (`OIDC_ALLOWED_EMAILS`), see
  `docs/google-sign-in.md`. Set the Google project to **"In production"**: in "Testing"
  mode Calendar access expires every 7 days. That doc still needs this note added.
- Before going online: update frontend packages for security fixes (Next.js etc.), set up
  backups and a test copy, estimate AI running costs.
