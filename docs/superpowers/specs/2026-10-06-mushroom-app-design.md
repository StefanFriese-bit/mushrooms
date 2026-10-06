# Mushroom app for Stefan — design

Date: 06/10/2026 · Status: approved by Stefan on 06/10/2026 (agreed part by part, then the write-up as a whole).

Working name: "Mushroom app" (the final name is his to choose).

---

## 1. In plain words (what Stefan agreed)

- A mushroom foraging app on his iPhone, for his own use in the UK. It helps him identify what he finds, learn the
  dangerous lookalikes, and keep a private map of his finds.
- **No running costs.** It is a web app added to the iPhone's home screen: hosted free, maps free, the photo
  recognition runs on the phone itself. No server, no account, nothing to pay.
- **Safety first.** No app can be trusted to say a mushroom is safe to eat: in a 2023 study the best app was right
  49% of the time, and the deadly death cap was named as something else. So the photo scan only gives a shortlist;
  the app then takes him through the features that tell the species apart, side by side with the dangerous
  lookalikes; and it never gives an "edible" verdict. For anything he plans to eat, the photo goes to iNaturalist,
  where people who know mushrooms can confirm it.
- Five parts along the bottom: **Scan** (followed by **Check**), **Guide** (about 300 UK species written up in
  full), **Identify** (by questions, no photo needed), **Finds** (his own map) and **Learn** (the general rules).
- The guide is written in our own words. Every safety fact is checked against two independent reputable sources,
  listed on the page with the date checked. When sources disagree, the cautious answer wins.
- The photo scan is tested on thousands of UK photos before he relies on it. It stays switched off unless dangerous
  species make its shortlist at least 98 times in 100 when they are the right answer. Its measured record is shown
  on the scan screen.
- His finds stay on his phone only. A backup is one file in his iCloud Drive.
- The app's code and web address live in a personal GitHub account of his own. The code is public; nothing
  personal is in it.
- Order of work: the species list for his approval → the app with a few sample species, on his phone early as a
  clearly marked TEST version → the edible species and their lookalikes, plus the scan's test numbers → the rest
  of the 300.

## 2. Decisions (Stefan, 06/10/2026)

| Question | Answer |
|---|---|
| Where he forages | United Kingdom |
| Which species get the full write-up | A wider field guide: about 300 of the commoner UK species. Offered instead: the ~40 edibles with their lookalikes (80–100 species), or 15–20 to start |
| Kind of app | Web app on the home screen. Rejected: a full iPhone app (US$99 a year or a reinstall from the Mac every 7 days, and Xcode on the Mac) |
| What is in the app | Scan → Check, Guide, Identify, Finds, Learn — all of them (offered: fewer for version 1) |
| How the pages are checked | Two independent sources per safety fact, own words, sources and date on each page, automatic checks. An outside expert review was offered and not chosen |
| Photo scan | Tested first, a pass mark for dangerous species, its record shown on screen. Offered instead: add the scan last |
| Where his finds live | His phone only, with a backup file in iCloud Drive. Offered instead: sync to iPad/Mac through an online service |
| Where the app lives | A personal GitHub account of his own (created 06/10/2026: `StefanFriese-bit`). Offered instead: the company's GitHub account |
| When it first goes on his phone | Early: a TEST version with sample species once the app works. Offered instead: after the first batch |
| Extra cross-check (added 06/10/2026) | Once a list or a batch of pages is filled in, its safety facts are also checked against two or three more large sources. Where they disagree, the majority decides, a tie takes the cautious answer, and every disagreement is listed for Stefan. His words: "cross-reference it against two or three other large online sources of information to determine which items or which data is accurate" |

## 3. Facts this design stands on (checked 06/10/2026)

- **Photo apps are unreliable.** Clinical Toxicology, 2023 (Australian poison researchers): Picture Mushroom right
  49% of the time, Mushroom Identificator 35%, iNaturalist 35%; on poisonous mushrooms 44%, 30% and 40%; the death
  cap was named as something else twice by Picture Mushroom and once by iNaturalist.
  <https://pubmed.ncbi.nlm.nih.gov/36794335/>
- **iNaturalist's recognition is closed to other apps** (not public; paid access for a few partners). Their own
  suggestion: post an observation, or train your own model on their open photos.
  <https://forum.inaturalist.org/t/hidden-computer-vision-api/41775>
- **Free recognition models exist.** BVRA (Czech and Danish researchers) publish models trained on Danish Fungi 2020
  (Danish records) and on FungiTastic (about 350,000 observations of about 6,000 species, collected over twenty
  years; CVPR 2025 workshop), small to medium sizes. Licence on the model card: **CC BY-NC 4.0** — personal,
  non-commercial use only. Which UK species a model knows is measured, not assumed (6.3).
  <https://openaccess.thecvf.com/content/CVPR2025W/FGVC/html/Picek_FungiTastic_A_Multi-Modal_Dataset_and_Benchmark_for_Image_Categorization_CVPRW_2025_paper.html>,
  <https://huggingface.co/BVRA/tf_efficientnet_b5.in1k_ft_df20_299>
- **iPhone storage for a home-screen web app.** Safari 17 and later give a home-screen web app up to 60% of the
  disk, and `navigator.storage.persist()` exempts its data from automatic clearing.
  <https://webkit.org/?p=14403> (What deleting the home-screen icon does to the data is proven in stage 2,
  section 14; until then it is treated as losing the finds.)
- **OpenStreetMap's own map tiles may not be used offline.** Their policy: "Offline use is not permitted on
  tile.openstreetmap.org", no bulk downloading, cache at least 7 days, attribution shown.
  <https://operations.osmfoundation.org/policies/tiles/>
- **OpenFreeMap** serves OpenStreetMap maps with no registration, no keys and "no limits on the number of map views
  or requests". Its page does not mention offline caching. It is run by one person (Zsolt Ero) on donations.
  <https://openfreemap.org/>
- **iNaturalist's API limits:** at most 60 requests a minute and under 10,000 a day; downloading over 5 GB of
  photos an hour or 24 GB a day may get blocked; meant for apps, not scraping. (iNaturalist's own page answered
  403 on 06/10; the figures are as quoted in the pyinaturalist documentation.)
  <https://pyinaturalist.readthedocs.io/en/stable/user_guide/advanced.html>
- **GitHub Pages on the free plan works only from public repositories.**
  <https://docs.github.com/articles/creating-project-pages-manually>
- **Apple:** Stefan's Apple developer membership is planned for another project. Once it exists, this web app could
  be wrapped as a full iPhone app at no extra cost. Not part of this design.

## 4. Architecture

### 4.1 Two halves

1. **The app** — what runs on the phone. A static web app (HTML, CSS, TypeScript) with no server of ours: Vite to
   build it, Preact for the screens, a service worker (Workbox) for offline use, IndexedDB for the finds,
   MapLibre GL for the map, ONNX Runtime Web for the photo model.
2. **The content builder** — runs on the Mac, never on the phone. Scripts that make the species list, collect facts
   and photos, prepare and test the photo model, and run every content check. Its output (species records,
   photos, the model, reports) is committed and shipped with the app.

### 4.2 Parts of the app

| Part | What it does | Depends on |
|---|---|---|
| `species` | Loads the guide records (5.1); search; "in season now" | content files |
| `scan` | Loads the model on first use; scores up to three photos; applies the rules in 6.2; returns the shortlist. The rules are pure functions, tested without a model | `species`, model files |
| `check` | Builds the side-by-side feature table for a species and its lookalikes; takes his ticks; flags any tick that fits a lookalike better. Pure | `species` |
| `identify` | Narrows the species list from his answers; "not sure" never narrows. Pure | `species` |
| `finds` | The finds and their photos in IndexedDB; asks for persistent storage; backup and restore (7) | — |
| `map` | MapLibre with OpenFreeMap tiles; pins; his position; "take me there" to Apple Maps | `finds` |
| `inat` | Hands photos to the iNaturalist app through the iPhone's share sheet; reads the community's identification back from a pasted observation link (public API, no sign-in) | `finds` |
| `shell` | Tabs, offline mark, TEST banner, updates, About (credits, licences, storage state) | all |

### 4.3 How data moves

- Content builder → `content/species/*.json`, `public/photos/…`, `public/model/…`, `reports/…` → committed →
  GitHub Actions runs every check and test → GitHub Pages publishes.
- On the phone, the first open on Wi-Fi stores the app, the guide, the photos and the model. After that everything
  works offline except loading new map areas and talking to iNaturalist.
- His finds go nowhere unless he saves a backup file himself or hands a photo to iNaturalist himself.

## 5. The species guide

### 5.1 One record per species

- Names: the British Mycological Society's recommended English name where one exists; the scientific name and
  older scientific names.
- Edibility — exactly one of: **Edible, cooked** · **Edible, but some people react** · **Not edible** ·
  **Poisonous** · **Deadly**.
- Protected in the UK: yes/no, naming the law.
- Top points: 3 to 6 short lines.
- Where it grows (habitat, trees, soil) and season (months, from UK records).
- Spore print colour.
- Features used by Identify and Check: underside (gills, pores, teeth, ridges, smooth), ring, bag at the base,
  grows on (wood, ground, other), cap size range, flesh change when cut or bruised, smell.
- Lookalikes: each with a "how to tell them apart" row per feature, or the statement "no dangerous lookalike in
  the UK", which needs its own two sources.
- Photos: each with photographer, licence, link and view (top, underneath, base, young, old).
- Sources per field, and the date checked.
- Whether the photo model knows the species.

### 5.2 Choosing the 300

1. Count UK research-grade iNaturalist observations by species, limited to mushrooms and other larger fungi (no
   lichens, moulds or rusts).
2. Add every commonly picked UK edible, every dangerous lookalike of each, and every deadly UK species, whatever
   their counts.
3. Fill up to about 300 with the most-recorded species left.
4. **Stefan approves the list before any page is written.**

### 5.3 Rules for every page

- Our own words. Facts may come from any source; text and photos from field guides never.
- Every safety fact (edibility, top points, every "how to tell them apart" row) is backed by at least two
  independent reputable sources — for example the British Mycological Society, First Nature, Wild Food UK, Kew, and
  the mycology fact box on Wikipedia/Wikidata.
- When sources disagree, the cautious answer is used, and the page says the sources differ.
- Lookalike links are two-way.
- Photos come from UK research-grade iNaturalist observations (at least two people agreed on the species), taken
  from iNaturalist's open-data copy, under CC0, CC BY or CC BY-NC only, with the photographer credited on the photo.
  The aim is 6 to 8 per species, covering the top, the underneath and the base.
- The words "safe" and "safe to eat" never appear.
- **Cross-check (Stefan, 06/10/2026):** after a list or a batch of pages is filled in, every safety fact (edibility,
  danger level, each dangerous lookalike) is also checked against two or three further large sources — for now
  Wikipedia, MushroomExpert and, for the UK species it covers, the Woodland Trust. The majority decides; a tie takes
  the cautious answer; every disagreement is listed in a report for Stefan, with what was decided.

### 5.4 Checks on every change (an update is not published if any fails)

- Every record is complete, and every edibility value is one of the five.
- Every safety field has at least two different sources; every page has a date checked.
- Every lookalike link has its mirror.
- Every Deadly species is named as a lookalike on at least one edible species' page, or its own page states, with
  two sources, that it is not mistaken for a UK edible. Every edible species names its lookalikes or carries the
  sourced "no dangerous lookalike in the UK" statement.
- Every photo has a photographer, an allowed licence and a link.
- No forbidden words.
- The species in each batch match the list Stefan approved.

## 6. The photo scan

### 6.1 The model

- Candidates: BVRA models trained on Danish Fungi 2020 or FungiTastic, small to medium, converted to run in Safari
  and shrunk (8-bit numbers).
- The one used is the best performer in the test (6.3) that also finishes a three-photo scan in about 3 seconds on
  Stefan's iPhone (measured in the TEST version).
- Its species names are matched to our records, older names included. A species the model knows but the guide does
  not cover is shown by name with "Not in the guide — treat it as unknown".

### 6.2 The rules (pure functions, tested without the model)

1. Each photo is scored; the scores of up to three photos are averaged.
2. Species never recorded in the UK are removed.
3. Species out of season (from UK monthly record counts) are marked down, never removed.
4. The shortlist is the top five.
5. Any Poisonous or Deadly species scoring above the safety threshold is added to the shortlist however low it
   scores, and a red banner says a dangerous species is on the list and to do the checks first.
6. If the top score is below the "not sure" threshold, the screen says "Not sure" and offers Identify.
7. The screen shows the scan's measured record (6.3).
8. No edibility verdict on this screen. The next step is always Check.

Both thresholds are set from the test, not by hand.

### 6.3 The test, before he relies on it

- Test photos: UK research-grade iNaturalist observations of our 300 species that are not used as guide photos —
  several thousand in total, with a cap per species.
- Measured for each candidate model: right first; on the shortlist; and, when the photo is a Poisonous or Deadly
  species the model knows, how often that species makes the shortlist (rule 5 applied). Also: how many of the 300
  the model knows.
- **Pass mark:** dangerous species on the shortlist at least 98 times in 100. If no candidate passes, the scan is
  switched off in the build and its screen says why. Everything else works.
- Stefan sees the report (numbers, coverage, the species it cannot recognise) before the scan is switched on.

## 7. Finds, map and backups

- A find holds: GPS spot and its accuracy, date, photos (taken in the app or picked from his library, resized to
  about 1,600 pixels), species or "not identified yet", notes, the iNaturalist link and the community's
  identification once read.
- A find saves without signal. If GPS is off or refused, he places the pin by hand or saves without a spot.
- Map: OpenFreeMap (OpenStreetMap data), attribution shown. Map areas he has viewed are kept on the phone (a cache
  with a size limit), so a wood he looked at before setting off shows offline. No bulk downloading of areas. If
  OpenFreeMap stops answering, the map falls back to OpenStreetMap's own tiles, online only, as their policy
  requires. With no map at all, the pins and his position still show on a plain grid.
- Filters: by species, and "this month in past years".
- "Take me there" opens Apple Maps walking directions to the pin.
- Storage: the app asks the iPhone to keep its data (persistent storage); About shows whether that was granted.
- Backup: one file (finds and photos, a zip with a JSON index) shared to Files → iCloud Drive. A reminder shows when
  finds are not in a backup and the last backup is more than 7 days old.
- Restore: open the file. The whole file is checked before anything changes; a damaged file changes nothing. A
  restore adds finds by their id, so nothing is duplicated.

## 8. Screens

- **Scan:** take or pick up to three photos (top, underneath, base) → the shortlist (6.2) → Check.
- **Check:** the top match, or any species he picks, side by side with its lookalikes, one row per feature. He ticks
  what he sees; a tick that fits a lookalike better than the match is flagged red. It ends with "Before eating, get
  it confirmed" and "Send to iNaturalist".
- **Guide:** search, "in season now", the species pages (5.1).
- **Identify:** simple questions one at a time, each with drawings; the list narrows; "not sure" is always allowed.
- **Finds:** map and list, "add a find here", the find's own page.
- **Learn:** the top points for identifying any mushroom, how to take a spore print, the deadly families to know,
  and the UK foraging rules (landowner permission, protected species, taking only a little).
- **About:** version, credits (model, photos, maps), licences, storage state, backup.
- **TEST version:** a banner on every screen: "Test version — not for identifying mushrooms".

## 9. Safety guarantees and how each is enforced

| Guarantee | Enforced by | Proven by |
|---|---|---|
| The app never says a mushroom is safe to eat | No edibility verdict on Scan or Check; forbidden words checked in all text | Content check (5.4) and a test of the Scan and Check screens' text |
| A dangerous species on the scan's list is never hidden | Rule 6.2-5 | Unit tests and the model test's pass mark |
| The scan is off unless it passed | A build setting written from the latest test report | A test that the setting matches the report |
| Every safety fact has two sources | Content check (5.4) | The check itself, run against deliberately broken records |
| Lookalikes are two-way and every dangerous lookalike is linked | Content check (5.4) | Same |
| Photos are licensed and credited | Content check (5.4) | Same |
| His finds never leave the phone by themselves | No server; the only addresses the app calls are its own, the map's, and iNaturalist when he asks | An end-to-end test that records every network request |
| His finds are never lost silently | Persistent storage; backup reminder; restore checks the whole file first; updates never touch the finds store | Tests: backup and restore, a damaged file, an update with finds already stored |
| The TEST version cannot be mistaken for the real one | A banner on every screen while the TEST setting is on | A test on every screen |

## 10. Errors — what he sees

| What happens | What he sees |
|---|---|
| No signal | An "Offline" mark; everything works except new map areas and iNaturalist |
| The scan cannot run on this phone, or the model did not load | "The photo scan isn't available right now" and a button to Identify; the rest works |
| The scan is switched off (failed its pass mark) | "The photo scan is off: it didn't pass its safety test" and a button to Identify |
| GPS off or refused | Place the pin by hand, or save without a spot |
| Camera refused | Pick photos from the library |
| Storage not kept, or the phone nearly full | A warning on About and a prompt to back up |
| A damaged file, or not a backup | "That file can't be restored. Nothing was changed." |
| The map service is down | Falls back to OpenStreetMap while online; offline, the pins on a plain grid |
| An update fails half-way | The old version keeps working; the update tries again next time |

## 11. Testing

- Unit tests for every pure rule: scan rules, Check, Identify, backup and restore, a damaged backup file, an update
  with finds already stored.
- The content checks (5.4) on every change, plus deliberately broken records to prove each check fails when it
  should.
- The model test (6.3), run again whenever the model or the species list changes.
- End-to-end in Safari's engine (Playwright WebKit) at iPhone size: install, offline after the first load, a scan
  with fixed photos, a find with a simulated GPS spot, backup and restore, the map with no network, the network
  record (section 9).
- On Stefan's iPhone, with the TEST version: camera, GPS, Add to Home Screen, persistent storage, scan speed, the map
  offline, deleting and restoring from a backup.
- Nothing is published unless every check passes.

## 12. Delivery and ownership

- Project folder `~/Local Desktop/Claude Projects/mushroom-app`, its own git repository. Nothing on company systems.
- Code: a public repository in Stefan's personal GitHub account (`StefanFriese-bit`). He creates the empty
  repository and adds the build Mac's key as a deploy key with write access — a key that opens this one repository
  and nothing else, and can be removed at any time. Any one-time setting only the owner can change (such as
  switching on GitHub Pages) he does himself, with step-by-step help, in stage 2. A GitHub Actions workflow
  publishes to GitHub Pages only after every check passes.
- Licences: the text and code are his. Photos keep their own licences and credits. The model is CC BY-NC 4.0, so
  the app is for personal, non-commercial use and is never sold unless the model and the BY-NC photos are replaced.

## 13. Stages and when each is done

1. **The species list.** Done when Stefan approves it.
2. **The app with about 10 sample species.** All parts working, every check passing, tested in Safari's engine, then
   on his phone as the TEST version (the personal GitHub account is needed here). Done when he has tried it on his
   phone.
3. **The first batch:** every edible on the list and its dangerous lookalikes (about 80 to 100 species), the model
   test and its report, the scan switched on only if it passes. Done when every check passes and he has seen the
   numbers; then the TEST banner comes off.
4. **The rest of the 300**, in groups, each group published when its checks pass. Done at about 300.

Pages are written one at a time by default. Splitting the writing across helpers is faster but heavy on Stefan's
weekly allowance, so he is asked first.

## 14. Things to prove at the start of a stage, before relying on them

- **Stage 1:** that UK observation counts give a sensible list once lichens, moulds and rusts are left out; that the
  British Mycological Society's English names can be matched to the species.
  *Proven 06/10/2026:* 300 species after leaving out powdery mildews, tar spots, coral spot, ergot, two lichen parasites,
  rose black spot and holly speckle (these last four were found by reading the first list). British Mycological Society
  English names matched for 269 of 300 (73 of them through an older scientific name); 1 name set by hand with a
  source; 27 from iNaturalist; 3 none. The safety list was then cross-checked (Wikipedia, Woodland Trust —
  `reports/cross-check.md`), and Stefan approved the list on 06/10/2026: 17 deadly, 11 dangerous lookalikes, 38 edible,
  1 added by him (White Fibrecap), 233 most recorded.
- **Stage 2:** that the model runs in Safari on his iPhone in about 3 seconds per scan; that persistent storage is
  granted on his phone; that viewed map areas show offline; what deleting the home-screen icon does to the data;
  that the share sheet hands photos to the iNaturalist app.
  *Proven 06/10/2026 (the test version, stage 2a):* published at stefanfriese-bit.github.io/mushrooms only after
  every check passed on GitHub (type check, 80 tests, content check, build, browser tests in Safari's engine at
  iPhone size and in Chromium). On Stefan's iPhone it installs from Safari's Add to Home Screen and opens and works
  with Airplane Mode on. Not read yet: whether persistent storage is granted (About shows it; it matters once
  finds are kept). Not tested yet, on purpose: deleting the icon (only once he has nothing to lose).
- **Stage 3:** which of the 300 the model knows; whether any candidate passes the pass mark.

## 15. Not in this design

Sync to iPad or Mac; sharing finds; accounts; a server; notifications; recipes; selling it; Ordnance Survey maps;
downloading whole map areas for offline use; countries other than the UK; a full iPhone app (possible later, at no
extra cost, once an Apple developer membership exists).
