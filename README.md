# Bet Tracker

A personal sports-bet tracker for season-long player props, team win totals, award and playoff futures, and parlays.
Live at **https://zacherytaylor.github.io/bet-tracker/**

- **ESPN auto-refresh**: `.github/workflows/refresh-espn.yml` runs every hour (and on demand). It runs `scripts/refresh-espn.js`, which pulls player season stats and team records from ESPN and commits `data/bets.json`. The **Refresh ESPN** button does the same in the browser, but only on screen.
- **Charts and pace scoring**: summary cards (tickets, staked, potential payout, record/P&L/ROI, closing-line value), a stake-vs-payout chart by bet type or user, and a **Chart Report** that scores every prop, win total and parlay leg on pace. The **?** buttons explain every formula.
- **Bet entry form**: **Add bet**, **Edit**, **Mark hit** and **Mark miss** in the browser. Changes stay in that browser until saved:
  - **Commit to GitHub** writes `data/bets.json` through the GitHub API. It needs a fine-grained token with *Contents: Read and write* on this repo only, stored in that browser's localStorage and never in the repo. It re-reads the newest file and applies only the fields you changed, so the hourly refresh is never overwritten.
  - **Copy JSON** / **Download** export the whole file, so you can paste it in by hand instead.
- **Closing-line value (CLV)**: optional `odds` (when placed) and `closingOdds` per ticket. CLV % = (decimal placed ÷ decimal closing − 1) × 100.
- **Tech**: a static site with no build step (HTML/CSS/JS, Chart.js from a CDN with SRI) on GitHub Pages. Changes are made in [`bet-tracker-staging`](https://github.com/ZacheryTaylor/bet-tracker-staging) first, then the code files are promoted here.

## Data format

`data/bets.json` is a **list of bets**. It must start with `[` and end with `]`. Hand edits still work, and the form writes the same format.

```json
[
  {
    "id": "mahomes-pass-yds-2026",
    "kind": "player-prop",
    "desc": "Mahomes 4500+ passing yards",
    "subject": "Patrick Mahomes",
    "espnAthleteId": "3139477",
    "sport": "nfl",
    "timeline": "season",
    "stat": "passingYards",
    "target": 4500,
    "current": 0,
    "stake": 10,
    "payout": 19.09,
    "odds": -110,
    "closingOdds": -125,
    "status": "open",
    "user": "Zach"
  },
  { "id": "chiefs-wins-2026", "kind": "record", "desc": "Chiefs 11+ wins", "subject": "Kansas City Chiefs", "sport": "nfl", "timeline": "season", "target": 11, "current": 0, "losses": 0, "stake": 10, "payout": 21, "status": "hit", "settledAt": "2027-01-04", "user": "Zach" }
]
```

| Field | Notes |
|---|---|
| `kind` | `player-prop`, `record` (team win total), `parlay` (with `legs`), `award`, `future` |
| `target` / `current` | Stat line or wins needed / current total (ESPN fills `current`) |
| `stat` | `passingYards`, `passingTouchdowns`, `rushingYards`, `rushingTouchdowns`, `receivingYards`, `receptions`, `receivingTouchdowns` |
| `stake` / `payout` | Payout is the total return if it hits, stake included |
| `odds`, `closingOdds` | Optional American odds, used for CLV |
| `status`, `settledAt` | `open`, `hit` or `miss`. `settledAt` (YYYY-MM-DD) is set when a bet is settled |
| `espnAthleteId`, `espnTeamId`, `teamGamesPlayed`, `lastSync` | Filled in by the refresh |

Do **not** wrap bets in `"playerProp":`. That wrapper is only in `data/templates.json` as a copy source (the site also accepts it if pasted by mistake).
