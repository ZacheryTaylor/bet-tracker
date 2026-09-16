const fs = require("fs");
const path = require("path");
const { refreshPlayer } = require("./espn-player");

const file = path.join(__dirname, "..", "data", "bets.json");

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function pct(bet) {
  const t = Number(bet.target) || 1;
  return ((Number(bet.current) || 0) / t) * 100;
}
function walkTeams(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) { node.forEach((n) => walkTeams(n, acc)); return acc; }
  if (node.team && (node.stats || node.team.record)) acc.push(node);
  ["children", "standings", "entries"].forEach((k) => { if (node[k]) walkTeams(node[k], acc); });
  return acc;
}
async function refreshRecord(bet) {
  const res = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings");
  if (!res.ok) return;
  const q = norm(bet.subject);
  const entry = walkTeams(await res.json()).find((en) => {
    const names = [en.team?.displayName, en.team?.shortDisplayName, en.team?.abbreviation, en.team?.name];
    return names.some((n) => q && (norm(n).includes(q) || q.includes(norm(n))));
  });
  if (!entry) return;
  const stats = entry.stats || [];
  const wins = Number((stats.find((s) => s.name === "wins") || {}).value);
  const losses = Number((stats.find((s) => s.name === "losses") || {}).value);
  if (!Number.isNaN(wins)) bet.current = wins;
  if (!Number.isNaN(losses)) bet.losses = losses;
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
      } else if (bet.kind !== "award") await refreshPlayer(bet);
    } catch (e) {
      console.warn(bet.id || bet.desc, e.message);
    }
  }
  fs.writeFileSync(file, JSON.stringify(bets, null, 2) + "\n");
}

main();
