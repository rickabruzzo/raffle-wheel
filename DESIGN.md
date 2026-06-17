# Raffle Wheel — design

Date: 2026-06-17
Status: approved-for-implementation (pending spec review)

## Goal

A web page that reads raffle entrants from a Google Sheet, puts every entrant on
a spinning wheel, spins, and lands on a random winner — revealing their first
name, last name, and company. Hosted on Vercel so anyone with the link can use
it without the owner's laptop.

## Approach

Single static site — plain HTML + CSS + vanilla JavaScript, no framework and no
build step. Vercel serves the static files zero-config; a GitHub repo is
connected to Vercel so every push to `main` auto-deploys.

No server is needed: the page reads the Google Sheet directly from the browser.
Google's CSV export endpoints send permissive CORS headers
(`Access-Control-Allow-Origin: *`), so the fetch works from any origin,
including a public Vercel domain.

Rejected alternatives: a React/Vite app (needs a build step, overkill for one
screen) and a Node server in front (only needed for a *private* sheet, which we
are not using).

## Data source

- Input: a Google Sheet shared as "anyone with the link can view."
- The sheet URL is configured once in `config.js` (see Configuration). It is not
  a secret — it is already a view-by-link URL — so baking it into the deployed
  page is fine and is what lets everyone use the same URL.
- The app derives a CSV export URL from the configured sheet URL:
  - If the URL already contains `output=csv`, use it as-is.
  - Else if it is a "Publish to web" URL (`/spreadsheets/d/e/.../pub`), request
    it with `output=csv`.
  - Else extract the sheet id from `/spreadsheets/d/<ID>` and build a gviz CSV
    endpoint: `https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv`,
    carrying the tab `gid` from the URL when present.
- CSV is parsed by a small self-contained parser that handles quoted fields,
  embedded commas, escaped quotes, and CRLF line endings.

### Column detection

The first row is treated as headers. Columns are matched case-insensitively by
header text:

- first name: header contains `first` (and not `last`)
- last name: header contains `last`
- company: header contains `company`, `organization`, `org`, or `employer`

Extra columns (timestamp, email, etc.) are ignored. If separate first/last are
not found but a single `name` column exists, the name is split on the first
space (first token = first name, remainder = last name). If no usable
name/company columns are found, the app shows a clear error listing the headers
it expected and the headers it actually saw.

Each data row becomes one wheel entry. Duplicate rows each get their own slice
(de-duplication is out of scope for v1).

## Configuration (`config.js`)

A tiny file holding the only knobs the owner edits:

- `SHEET_URL` — the published/shared Google Sheet URL. **Required.** Until set,
  the page shows a friendly "configure your sheet" message instead of the wheel.
- `MAX_LABELS` — above this entrant count, slices render without text (default
  ~40; see "Many entrants" below).
- Optional theme color list for the slices.

An optional in-page "use a different sheet" control lets the owner override the
configured sheet from their own browser only (stored in `localStorage`); it does
not affect what other visitors see.

## UI and behavior

- A colorful canvas wheel with a fixed pointer at the top and a Spin button.
- Up to `MAX_LABELS` entrants: first names are drawn on the slices. Above it:
  colored slices with no text (labels would be unreadable), and the winner is
  revealed only in the card.
- Spin: ~4–5s, eased deceleration with several full rotations, then it stops.
- Winner card: large `First Last`, `Company` underneath, an initials avatar, and
  a lightweight self-contained confetti burst.
- Controls after a win: "Remove winner & spin again" (winner leaves the wheel —
  draw 2nd, 3rd, …) and "Keep & spin again" (full list). A "Reset" reloads all
  entrants from the sheet.
- A running winners list (1st, 2nd, …) and a remaining-entrants count.

### Correctness guarantee

The winner is chosen first — a uniform random pick over the current entrants —
and the wheel is then animated to land with that entrant's slice centered under
the pointer. What the user sees and who is recorded as the winner always match.
The visual is never the source of truth.

## Error handling / edge cases

- Sheet fails to load (network, not shared, bad URL) → friendly error naming the
  likely cause.
- Zero data rows → "no entrants found."
- Columns not found → message with expected vs. seen headers.
- One entrant → single-slice wheel, spins and lands on them.
- All entrants removed → "everyone has won" state with a Reset button.

## Files

```
raffle-wheel/
  index.html     markup + <script>/<link> tags
  styles.css     all styling
  config.js      SHEET_URL + tunables — the file the owner edits
  app.js         sheet loading, CSV parse, wheel render, spin, winner flow
  README.md      what it is, how to set SHEET_URL, how to deploy
  DESIGN.md      this document
  .gitignore
```

Each file has one job so it can be understood and changed in isolation. The
owner only ever needs to touch `config.js`.

## Deployment (GitHub → Vercel auto-deploy)

1. Scaffold files; `git init` and an initial commit.
2. Create a GitHub repo and push (e.g. `gh repo create raffle-wheel --public
   --source=. --push`).
3. In the Vercel dashboard: Add New Project → import the repo → framework preset
   "Other" → Deploy (no build settings needed).
4. Vercel returns a public URL (e.g. `raffle-wheel.vercel.app`) and redeploys on
   every push to `main`.

Updating entrants needs no redeploy — the page reads the sheet live on each
load. Redeploys are only for code/config changes.

## Verification

- Local: serve the folder (`npx serve` / `python3 -m http.server` / `vercel
  dev`), point `SHEET_URL` at a test sheet with sample first/last/company rows,
  and confirm: names load, wheel renders, the spin lands on the revealed winner
  (card matches the slice under the pointer), remove-and-respin works, reset
  works, and each error state renders.
- Post-deploy: open the Vercel URL in incognito / on a phone and confirm it loads
  entrants and spins with no laptop involved.

## Non-goals (v1)

No login/access control, no editing the sheet from the page, no weighted odds,
no de-duplication, no prize-tier metadata beyond sequential draws, no animations
beyond the spin and confetti. These can go on a later list if wanted.

---

## Amendment v2 (2026-06-17) — ODS upload, single present-to-win winner, branding, GDPR purge

This amendment is the current truth where it conflicts with the v1 body above.
The wheel rendering and the choose-winner-first spin geometry are unchanged.

### Data input: local ODS upload replaces Google Sheets

- Google Sheets / `SHEET_URL` / live CSV fetch / the per-browser sheet override are
  all removed. Instead the operator uploads an OpenDocument Spreadsheet (`.ods`) in
  the page. It is parsed entirely in the browser; nothing is uploaded to any server.
- Parsing uses the SheetJS library, **vendored into the repo** (`vendor/xlsx.full.min.js`)
  so it works without a CDN / on poor conference wifi. SheetJS reads the first sheet
  into an array-of-rows, which then flows through the existing column logic.
- `sample.csv` is replaced by `sample.ods` for local verification.

### Entrant pipeline (on file load), in order

1. Parse the `.ods` first sheet to rows.
2. **Exclude** any row whose email domain is in `CONFIG.EXCLUDE_DOMAINS` (default
   `["honeycomb.io"]`) — matches the domain exactly *or* a subdomain
   (`eng.honeycomb.io`), case-insensitive. These are employees / test entries.
3. **De-duplicate** by email (lower-cased, trimmed); keep the first occurrence.
   Rows with no email are kept as-is (cannot be deduped or domain-checked).
4. Map to `{first, last, company}`. The email column is detected and used for
   steps 2–3 but is **never displayed**.
5. Show a load summary, e.g. "248 entrants loaded — excluded 11 @honeycomb.io,
   merged 3 duplicates", so the operator can confirm the filters fired.

`findColumns` gains an `email` match (header contains `email` / `e-mail`).

### Winner model: single winner, present-to-win

- There is exactly one prize and one winner per raffle.
- A spin lands on a candidate, shown in the winner card. If that person is in the
  room, they win — done. If not, **"Not here — remove & spin again"** removes that
  entrant from the wheel and immediately redraws.
- The accumulating winners list is **removed**. No-shows are never recorded or
  displayed anywhere. ("Keep & spin again" and the winners panel from v1 are gone.)

### Branding, conference, prize

- Honeycomb logo in the header (the provided RGB SVG with the wordmark recolored to
  white for the dark UI; hexagon colors unchanged), vendored at `assets/honeycomb-logo.svg`.
- Conference-name text field, shown in the header next to the logo.
- Optional prize: a transparent PNG upload + a prize-title text field, shown in a
  prize panel near the wheel. Layout adapts: image + title; title only (no image);
  or panel hidden (neither). Image is held in memory (object URL), not persisted.

### Raffle complete → GDPR purge

- A "Raffle complete" control (header). On confirm, it wipes all loaded entrant data
  and the parsed file from memory, clears any browser storage this app set, and
  returns to the empty upload screen.

### Persistence policy

- Entrant data and the uploaded file are **never** persisted (no `localStorage`,
  no `IndexedDB`, no server) and do not survive a reload — this is what makes the
  purge complete. Only non-PII setup values (conference name, prize title) may be
  kept in `localStorage` for convenience, and the purge clears those too.

### Sharing / hosting

- Unchanged: public static site on Vercel, GitHub auto-deploy. Visitors need no
  account and nothing installed — each runs the tool client-side (uploads their own
  `.ods`). It is a tool, not a shared live view (the latter would need a server and
  is explicitly out of scope, per the GDPR policy above).

### Files touched

- Add: `vendor/xlsx.full.min.js` (SheetJS), `assets/honeycomb-logo.svg`, `sample.ods`.
- Remove: `sample.csv`. Repurpose: `config.js` (`SHEET_URL` → `EXCLUDE_DOMAINS`,
  keep `MAX_LABELS`, `COLORS`).
- Rework: `index.html` (header/logo/conference/prize/upload + draw states),
  `styles.css` (adaptive layout), `app.js` (file upload + ODS parse + pipeline +
  single-winner flow + purge).
- `lib.js` gains pure, tested helpers: `excludeByDomain(rows/entrants, domains)`,
  `dedupeByEmail(...)`, and an extended `findColumns`/`rowsToEntrants` that handle
  the email column. Geometry + CSV parser stay.

### Testing

- TDD for the new pure logic in `lib.js` (domain exclusion incl. subdomains,
  email de-dupe, email-column detection, email never surfaced in the mapped entrant).
- ODS parsing + the full UI (upload → filter summary → spin → present-to-win →
  purge → empty state) verified by running against `sample.ods`.

---

## Amendment v3 (2026-06-17) — show-time presentation

Presentation only; the v2 data pipeline and winner logic are unchanged.

- **Two screens.** Setup (conference / prize / file upload / load summary +
  "Start raffle →") and a clean full-screen spin view with none of the inputs. A
  header "Setup" button returns to setup; loaded entrants persist across the toggle.
- **One screen, no scroll.** The spin view is locked to the viewport
  (`body { height:100dvh; overflow:hidden }`); the wheel auto-sizes to the
  available square in JS (`sizeWheel`, re-run on `resize`).
- **Big winner splash.** A fixed full-screen overlay: prize image (if uploaded),
  "WINNER", the name at `clamp(44px,12vw,150px)`, company, "wins <prize>", and
  full-screen confetti. Actions: "They're here — done" (dismiss) and
  "Not here — spin again" (remove the candidate + redraw).
- **Sound.** Web Audio, no asset files: a ratchet tick on each slice-pass that
  slows with the wheel (throttled to ≥28 ms apart) and a four-note win chime.
  A "Sound: on/off" header toggle; the AudioContext is created/resumed on the
  spin click (autoplay-policy safe).
- **CSS note:** an explicit `[hidden] { display: none !important; }` is required
  because `.draw`/`.overlay`/`.prize` set `display` via their class, which would
  otherwise override the user-agent `[hidden]` rule and leave them visible.
