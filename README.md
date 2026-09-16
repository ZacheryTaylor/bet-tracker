# Bet Tracker

Edit [`data/bets.json`](data/bets.json). It must start with `[` and end with `]`. That file is a **list of bets**, not the `playerProp` wrapper from templates.json.

## Working file (copy this whole thing)

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
    "status": "open"
  }
]
```

Add another bet with a comma after the `}` of the previous bet:

```json
[
  { "id": "bet-1", "kind": "player-prop", "desc": "...", "subject": "...", "sport": "nfl", "timeline": "season", "stat": "passingYards", "target": 4500, "current": 0, "status": "open" },
  { "id": "chiefs-wins-2026", "kind": "record", "desc": "Chiefs 11+ wins", "subject": "Kansas City Chiefs", "sport": "nfl", "timeline": "season", "target": 11, "current": 0, "losses": 0, "status": "open" }
]
```

Do **not** wrap bets in `"playerProp":`. That wrapper is only in `data/templates.json` as a copy source.

The site now also accepts a single object or the template wrapper if you paste that by mistake.
