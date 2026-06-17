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
