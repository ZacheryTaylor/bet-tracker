# Bet Tracker

Personal sports bet tracker hosted on GitHub Pages. Bets are stored in [`data/bets.json`](data/bets.json) so any computer that opens the site can see what you entered.

**Live site (after Pages is on):** https://zacherytaylor.github.io/bet-tracker/

## 1. Turn on GitHub Pages

1. Open https://github.com/ZacheryTaylor/bet-tracker/settings/pages
2. Source: **Deploy from a branch**
3. Branch: **main** / **/ (root)**
4. Save. Wait a minute, then open the Pages URL.

## 2. Save from any computer

Viewing bets needs no extra setup. **Adding or editing** from a browser writes `data/bets.json` through the GitHub API.

1. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens) with **Contents: Read and write** on `ZacheryTaylor/bet-tracker`.
2. On the site, open **Settings**, paste the token, click **Save token**.
3. The token stays in that browser only. Repeat Settings on each computer you use to enter bets.

The token is never committed to the repo.

## 3. ESPN refresh

**Refresh ESPN** pulls unofficial scoreboard JSON:

`https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`

Use a team name, event date, and metric (team win, spread, or total). Player/season props stay manual.

## Local files

| File | Role |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Clean layout |
| `app.js` | Bets, filters, ESPN, GitHub save |
| `data/bets.json` | Shared bet list |
