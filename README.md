# Bet Tracker

No login. Add bets by editing [`data/bets.json`](data/bets.json) in this repo (GitHub web editor is fine). The site reads that file. ESPN refresh fills `current` so the bar moves.

Live: https://zacherytaylor.github.io/bet-tracker/

## Add a bet (no code logic)

1. Open [`data/bets.json`](https://github.com/ZacheryTaylor/bet-tracker/edit/main/data/bets.json)
2. Copy a template from [`data/templates.json`](data/templates.json)
3. Paste it inside the `[ ]` array. Commas between objects.
4. Change `id`, names, `target`, and `stat` / `line`
5. Commit. Wait a minute, refresh the site.

### Player prop

```json
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
  "status": "open"
}
```

`espnAthleteId` is optional if `subject` matches ESPN’s player name. `stat` examples: `passingYards`, `passingTouchdowns`, `rushingYards`, `receivingYards`, `receptions`, `points`, `rebounds`, `assists`, `homeRuns`, `goals`.

### Team record

```json
{
  "id": "chiefs-wins-2026",
  "kind": "record",
  "desc": "Chiefs 11+ wins",
  "subject": "Kansas City Chiefs",
  "sport": "nfl",
  "timeline": "season",
  "target": 11,
  "current": 0,
  "losses": 0,
  "status": "open"
}
```

### Game (win / spread / total)

`metric` is `team-win`, `spread`, `total-over`, or `total-under`. Include `date` as `YYYY-MM-DD` and `line` for spread/total.

Sports: `nfl`, `ncaaf`, `nba`, `ncaab`, `mlb`, `nhl`, `soccer`, `other`.

## ESPN updates

- **Refresh ESPN** on the site (live numbers; may be blocked by CORS).
- GitHub Action **Refresh ESPN stats** hourly and from Actions → Run workflow. That writes `current` back into `data/bets.json` so every computer sees it.
