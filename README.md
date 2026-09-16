# Bet Tracker

Public, view-only bet list. Add/edit requires the site passcode **and** a GitHub token so saves write `data/bets.json`.

Live: https://zacherytaylor.github.io/bet-tracker/

## Why bets were not saving

GitHub Pages cannot write the repo by itself. The browser must call the GitHub Contents API with a token. Without a token, bets only appeared until you refreshed.

## One-time setup (so saves stick)

1. Pages: repo **Settings → Pages → Deploy from a branch → main / root**.
2. Create a [fine-grained PAT](https://github.com/settings/personal-access-tokens) for `ZacheryTaylor/bet-tracker` with **Contents: Read and write**.
3. On the site, enter the passcode (default in `app.js`: `tracker`).
4. Paste the token, click **Save token**. Do this once per browser you use to edit.

Change the passcode by editing `PASSCODE` in `app.js` and committing.

Do not share the GitHub token. The passcode only hides the edit UI; it is not real security.

## Bet types

- **Player prop** — name, market (yards, TDs, etc.), current vs target. Update current as the season/game progresses. ESPN does not reliably auto-fill player props.
- **Team record** — wins / losses vs a win target. **Refresh ESPN** fills wins-losses from standings when the team name matches.
- **Game result** — single-game win, spread, or total from the ESPN scoreboard.
