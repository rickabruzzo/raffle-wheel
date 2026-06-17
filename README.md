# Raffle wheel

A public web page that runs a "must be present to win" raffle: upload your
entrants as an OpenDocument Spreadsheet (`.ods`), spin a wheel, and reveal a
random winner (first name, last name, company). Hosted on Vercel; nothing is
ever sent to a server.

## Run the raffle

1. Open the page. Optionally set the **conference name**, a **prize title**, and
   upload a transparent **prize PNG**.
2. Upload your **entrants `.ods`**. The file needs columns whose headers contain
   **First**, **Last**, **Company**, and **Email**.
   - `@honeycomb.io` addresses (employees / test entries, including subdomains)
     are dropped automatically.
   - Duplicate emails are merged.
   - Email is used only for those two steps — it is never displayed.
3. Hit **Start raffle →** for the full-screen wheel (toggle effects with
   **Sound: on/off** in the top bar). **Spin.** When the wheel lands on someone:
   - If they're in the room, they win.
   - If not, click **Not here — remove & spin again** to drop them and redraw.
4. **Raffle complete** wipes the uploaded entrants and all their data from the
   browser (GDPR), returning to the upload screen.

Entrant data lives only in memory — it is never written to disk, never uploaded,
and does not survive a page reload. `sample.ods` is included if you want to try
it.

## Configure

`config.js` holds the tunables: `EXCLUDE_DOMAINS` (default `["honeycomb.io"]`),
`MAX_LABELS` (above this many entrants, slices render without text), and the
slice `COLORS`.

## Run locally

```
python3 -m http.server 5000
# open http://localhost:5000
```

## Tests

```
node --test
```

Pure logic (column detection, domain exclusion, de-dupe, wheel geometry) lives in
`lib.js` and is unit-tested. ODS parsing uses the vendored SheetJS
(`vendor/xlsx.full.min.js`). To regenerate the sample file:
`python3 scripts/make_sample_ods.py`.

## Deploy

Connected to Vercel via GitHub: every push to `main` auto-deploys. No build step
(static site). Anyone with the URL can use it — no account needed.
