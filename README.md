# Raffle wheel

A web page that reads raffle entrants from a Google Sheet, spins a wheel, and
reveals a random winner (first name, last name, company). Hosted on Vercel.

## Configure your sheet

1. In Google Sheets: Share → General access → "Anyone with the link" → Viewer.
   (Or File → Share → Publish to web.)
2. Copy the sheet URL from the address bar.
3. Open `config.js` and paste it into `SHEET_URL`. The sheet needs columns whose
   headers contain "First", "Last", and "Company" (extra columns are ignored).
4. Commit and push — Vercel redeploys automatically.

Entrant changes in the sheet show up on the next page load — no redeploy needed.

## Run locally

```
python3 -m http.server 5000
# open http://localhost:5000
```

Leave `SHEET_URL` as `./sample.csv` to preview with bundled sample data.

## Tests

```
node --test
```

## Deploy

Connected to Vercel via GitHub: every push to `main` auto-deploys. No build step
(static site).
