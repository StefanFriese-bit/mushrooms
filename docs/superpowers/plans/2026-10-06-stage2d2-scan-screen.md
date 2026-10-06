# Stage 2d-2: the Scan screen — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Scan tab (spec 6.2, 8, 10): he takes or picks up to three photos (top, underneath, base); the model
chosen by the scan test scores them on the phone; the rules of `src/scan/rules.ts` turn the scores into the
shortlist; the screen shows it with the red banner, "Not sure" → Identify, the scan's measured record, and Check as
the next step. The scan works offline once the app has been opened on Wi-Fi. It is switched off when the test says so.

**Architecture:** Everything the test chose is read from `content/model/scan-settings.json` (written by
`tools/evaluate-scan.ts`: `passed`, `file`, `size`, `fit`, `thresholds`, `record`). `src/scan/engine.ts` loads
onnxruntime-web lazily (single-threaded WebAssembly, or WebGPU if the iPhone speed test showed it is faster), keeps one
session, and scores a photo. `src/scan/scan.ts` is the pure glue: photos' scores → `combine` → `shortlist` with the
settings' thresholds and the month → what the screen shows, with English names from `content/species-list.json` and
the guide's pages. The service worker stores the model and the engine file on the first open, so the scan works
offline. Photos stay in memory until Finds exists (stage 2b).

**Decisions (within the approved spec):**
- **No percentages on the shortlist:** the order and the danger tags only. People trust a "93%"; the test showed the
  first answer is wrong often enough that a number would mislead.
- **A photo is first scaled to 500 px on its longer side, then prepared as the test prepared its 500 px photos**
  (`prepare.ts`, the fit the test chose), so the phone's 12-megapixel photos reach the model as the test photos did.
- **The scan is off when `passed` is false**, with the reason and a button to Identify (spec 10); a test proves the
  setting matches the report (spec 9).

**Files:**

| File | What it does |
|---|---|
| `src/scan/settings.ts` (+ test) | reads `scan-settings.json`; the record as words |
| `src/scan/scan.ts` (+ test) | scores → shortlist → the rows the screen shows (names, pages, danger, "added for safety") |
| `src/scan/engine.ts` | onnxruntime-web, one session, `score(photo)` |
| `src/scan/prepare.ts` | adds the 500 px step |
| `src/screens/scan.tsx` | the screen |
| `src/screens/check.tsx` | "Send these photos to iNaturalist" when the scan has photos |
| `vite.config.ts` | the model and the engine file stored by the service worker |
| `tests/scan-settings.test.ts` | the setting matches the report |
| `e2e/app.spec.ts` | a scan with the Deathcap's guide photo in both engines |

### Task 1: Settings and the shortlist rows (pure)

- [ ] Failing tests: `scanRows(result, classes, englishByName, pages)` gives, per shortlist item, the English name
  (or the scientific name when it has none), the guide page or `null` ("Not in the guide — treat it as unknown"), the
  danger, and "added for safety"; `recordWords(settings)` → "In the test on 2,931 UK observations: right first 61%,
  on the shortlist 88%, dangerous species on the shortlist 98.5%." (figures from the settings, never typed).
- [ ] The code; commit — `feat(scan): the shortlist rows and the measured record, from the test's settings`.

### Task 2: The setting matches the report (spec 9)

- [ ] Failing test: `scan-settings.json` says `passed: true` exactly when `reports/scan-test.md` says a model "passes
  and is the best phone-sized model", and names the same model; `file` exists under `public/`.
- [ ] Commit — `test(scan): the switch follows the test report`.

### Task 3: The engine

- [ ] `src/scan/engine.ts`: `load()` once (lazy `import('onnxruntime-web/wasm')`, `wasmPaths = BASE + 'ort/'`,
  `numThreads = 1`, the model from `settings.file`), `score(photo)` → `Float32Array` of 1,604 probabilities; errors
  become "The photo scan isn't available right now" (spec 10). WebGPU only if the iPhone speed test chose it.
- [ ] `prepare.ts`: photos larger than 500 px on the longer side are first drawn at 500 px.
- [ ] Commit — `feat(scan): the engine on the phone`.

### Task 4: Offline

- [ ] `vite.config.ts`: the service worker stores `models/<chosen file>` and `ort/ort-wasm-simd-threaded.wasm` on
  install (`globPatterns` + `maximumFileSizeToCacheInBytes` 30 MB); the WebGPU engine file only if WebGPU is used.
- [ ] Browser test: after the first open, with the server stopped, a scan still runs.
- [ ] Commit — `feat(scan): works offline after the first open`.

### Task 5: The screen

- [ ] Three slots (Top, Underneath, Base), each a file input (`accept="image/*"`: the iPhone offers the camera or the
  library), a thumbnail and "remove"; "Scan" once one photo is in. While working: "Getting the scan ready (first time
  only)…" then "Scanning…". The result: the red banner when a dangerous species is on the list ("A dangerous species
  is on this list. Do the checks before anything else."); "Not sure" with the Identify button; the shortlist rows,
  each with Check when it has a page; the measured record; and "A shortlist is not an identification. The next step
  is Check." (the forbidden word is never used).
- [ ] Off: "The photo scan is off: it didn't pass its safety test." + Identify (spec 10).
- [ ] Commit — `feat(scan): the Scan screen`.

### Task 6: Check hands the photos to iNaturalist

- [ ] When the scan has photos, Check's last box offers "Send these photos to iNaturalist" (`navigator.share` with
  the files; the share sheet shows the iNaturalist app), else "Open iNaturalist".
- [ ] Commit — `feat(check): send the scan's photos to iNaturalist`.

### Task 7: Browser tests, publish, his try

- [ ] Both engines: the Deathcap's guide photo → the Deathcap on the shortlist and the red banner; no "safe", no
  edibility words; the off state when the settings say off (a build with a test setting).
- [ ] Publish; Stefan scans real mushrooms on his iPhone (with the TEST banner on).
