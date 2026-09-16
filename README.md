# Bet Tracker

Add and update bets **on the website**. Do not edit code for each bet.

Live: https://zacherytaylor.github.io/bet-tracker/

## One-time connect (required for other computers)

1. [Create a fine-grained PAT](https://github.com/settings/personal-access-tokens/new)
2. Owner `ZacheryTaylor`, only repo `bet-tracker`, permission **Contents: Read and write**
3. On the site, Unlock with passcode `tracker`, paste the token, **Unlock and connect**
4. The site stores the token in `config.js` and writes every bet to `data/bets.json` by itself

After that, any computer opening the site can see the list. Unlock again only when you need to add or edit.

The token can rewrite files in this repo. Keep Contents scoped to `bet-tracker` only.
