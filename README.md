# AI Market Pulse

A static AI-industry news/market snapshot site. Every card links back to its original source.

## What's live vs. curated

- **Live, refreshed automatically every ~30 min:** Big AI wire, Frontier releases, Local & open-weight feed, Breakthrough signals, AI stocks (price/change). Pulled from official publisher RSS feeds and Yahoo Finance — every card links to its original article or quote page.
- **Curated snapshot, updated by hand:** Frontier leaderboard, Market share donut, Compute & chips pricing. No reliable free live API exists for these (benchmark rankings, web-traffic share, GPU rental pricing indexes), so they stay as periodically-updated numbers with links to the real public trackers (LMArena, Artificial Analysis, Similarweb, Cloudflare Radar, cloud-gpus.com). To refresh them, edit the `leaderboard`, `legend`, and `compute` arrays directly in the `<script>` block of `index.html`.

## Local development

```
node scripts/update-data.mjs   # fetches feeds + stock quotes, writes data/latest.json
npx serve .                    # or any static file server
```

Open the served URL — the page fetches `data/latest.json` client-side.

## Automation

`.github/workflows/update-data.yml` runs `scripts/update-data.mjs` on a 30-minute
GitHub Actions cron schedule and commits `data/latest.json` if it changed. No API
keys or secrets are required — every data source used is either a public RSS feed
or Yahoo Finance's no-key quote endpoint.

## Deploying for free (GitHub Pages)

1. Create a new **public** GitHub repo and push this folder to it:
   ```
   git remote add origin https://github.com/<you>/<repo>.git
   git branch -M main
   git push -u origin main
   ```
2. In the repo, go to **Settings → Actions → General → Workflow permissions** and select
   **"Read and write permissions"** (required so the scheduled workflow can commit
   `data/latest.json` back to the repo).
3. Go to **Settings → Pages**, set **Source** to **"Deploy from a branch"**, branch
   `main`, folder `/ (root)`. Save.
4. Your site will be live at `https://<you>.github.io/<repo>/` within a minute or two.
5. Optionally trigger the first data refresh manually: **Actions → Update AI Market
   Pulse data → Run workflow** (otherwise it runs automatically on the next
   30-minute tick).

GitHub Pages and GitHub Actions are both free for public repositories. No server to
maintain, no hosting bill.

## Notes / limits

- Yahoo Finance's quote endpoint is unofficial and free but undocumented — it could
  change or rate-limit without notice. Acceptable for a low-traffic hobby site.
- RSS sources are official publisher feeds only (no Google News, which restricts its
  RSS to personal feed-reader use).
- Category detection (release vs. wire vs. open-weight vs. research) is keyword-based
  and will occasionally misclassify a headline — it's a heuristic, not a guarantee.
