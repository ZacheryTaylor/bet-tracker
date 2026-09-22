const fs = require("fs");
const path = require("path");
const { refreshPlayer } = require("./espn-player");
const { findOverallRecord } = require("./team-record");

const file = path.join(__dirname, "..", "data", "bets.json");

function pct(bet) {
  const target = Number(bet.target) || 1;
  return ((Number(bet.current) || 0) / target) * 100;
}

async function refreshRecord(bet) {
  const res = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings");
  if (!res.ok) throw new Error(`Standings ${res.status}`);
  const record = findOverallRecord(await res.json(), bet.subject);
  if (!record) throw new Error(`No overall record found for ${bet.subject}`);
  bet.current = record.wins;
  bet.losses = record.losses;
  bet.ties = record.ties;
  bet.lastSync = new Date().toISOString();
  if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit";
}

async function main() {
  const bets = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const bet of bets) {
    try {
      if (bet.kind === "record") await refreshRecord(bet);
      else if (bet.kind === "parlay") {
        for (const leg of bet.legs || []) {
          leg.sport = leg.sport || "nfl";
          await refreshPlayer(leg);
        }
      } else if (bet.kind !== "award") {
        await refreshPlayer(bet);
      }
    } catch (error) {
      console.warn(bet.id || bet.desc, error.message);
    }
  }
  fs.writeFileSync(file, JSON.stringify(bets, null, 2) + "\n");
}

main();
