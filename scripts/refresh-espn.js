const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "bets.json");
const YEAR = new Date().getFullYear();

const SPORTS = {
  nfl: { path: "football/nfl", standings: "football/nfl", athlete: "football/nfl" },
  ncaaf: { path: "football/college-football", standings: "football/college-football", athlete: "football/college-football" },
  nba: { path: "basketball/nba", standings: "basketball/nba", athlete: "basketball/nba" },
  ncaab: { path: "basketball/mens-college-basketball", standings: "basketball/mens-college-basketball", athlete: "basketball/mens-college-basketball" },
  mlb: { path: "baseball/mlb", standings: "baseball/mlb", athlete: "baseball/mlb" },
  nhl: { path: "hockey/nhl", standings: "hockey/nhl", athlete: "hockey/nhl" }
};

const STAT_NAMES = {
  passingYards: ["passingYards", "passingYds", "netPassingYards"],
  passingTouchdowns: ["passingTouchdowns", "passingTDs"],
  rushingYards: ["rushingYards"],
  rushingTouchdowns: ["rushingTouchdowns"],
  receivingYards: ["receivingYards"],
  receptions: ["receptions"],
  receivingTouchdowns: ["receivingTouchdowns"],
  points: ["points"],
  rebounds: ["rebounds"],
  assists: ["assists"],
  threePointers: ["threePointFieldGoalsMade"],
  homeRuns: ["homeRuns"],
  rbi: ["RBIs", "rbi"],
  goals: ["goals"],
  saves: ["saves"],
  wins: ["wins"]
};

function pct(bet) {
  const t = Number(bet.target) || 1;
  return Math.max(0, Math.min(100, ((Number(bet.current) || 0) / t) * 100));
}
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function walk(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, fn)); return; }
  fn(node);
  Object.values(node).forEach((v) => walk(v, fn));
}
function extractStat(data, stat) {
  const names = STAT_NAMES[stat] || [stat];
  const hits = [];
  walk(data, (obj) => {
    const n = String(obj.name || "");
    if (obj.value == null) return;
    if (names.some((x) => n.toLowerCase() === x.toLowerCase())) hits.push(Number(obj.value));
  });
  return hits.length ? hits[hits.length - 1] : null;
}
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + " " + res.status);
  return res.json();
}

async function refreshPlayer(bet) {
  const sport = SPORTS[bet.sport];
  if (!sport || !bet.stat) return;
  let id = bet.espnAthleteId;
  if (!id && bet.subject) {
    const data = await getJson(`https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(bet.subject)}&limit=8`);
    walk(data, (obj) => {
      if (!id && obj.id && norm(obj.displayName || obj.fullName || "").includes(norm(bet.subject))) id = String(obj.id);
    });
  }
  if (!id) return;
  const data = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${sport.athlete}/athletes/${id}/stats?season=${YEAR}&seasontype=2`);
  const value = extractStat(data, bet.stat);
  if (value == null) return;
  bet.current = value;
  bet.espnAthleteId = id;
  bet.lastSync = new Date().toISOString();
  if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit";
}

function walkTeams(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) { node.forEach((n) => walkTeams(n, acc)); return acc; }
  if (node.team && (node.stats || node.team.record)) acc.push(node);
  ["children", "standings", "entries"].forEach((k) => { if (node[k]) walkTeams(node[k], acc); });
  return acc;
}

async function refreshRecord(bet) {
  const sport = SPORTS[bet.sport];
  if (!sport) return;
  const data = await getJson(`https://site.api.espn.com/apis/v2/sports/${sport.standings}/standings`);
  const q = norm(bet.subject);
  const entry = walkTeams(data).find((en) => {
    const names = [en.team?.displayName, en.team?.shortDisplayName, en.team?.abbreviation, en.team?.name];
    return names.some((n) => q && (norm(n).includes(q) || q.includes(norm(n))));
  });
  if (!entry) return;
  const stats = entry.stats || [];
  const wins = Number((stats.find((s) => s.name === "wins") || {}).value);
  const losses = Number((stats.find((s) => s.name === "losses") || {}).value);
  bet.current = Number.isNaN(wins) ? bet.current : wins;
  bet.losses = Number.isNaN(losses) ? bet.losses : losses;
  bet.lastSync = new Date().toISOString();
  if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit";
}

async function refreshGame(bet) {
  const sport = SPORTS[bet.sport];
  if (!sport) return;
  const dates = (bet.date || "").replaceAll("-", "");
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${sport.path}/scoreboard${dates ? "?dates=" + dates : ""}`);
  const event = (data.events || []).find((ev) => {
    const comps = ev.competitions?.[0]?.competitors || [];
    return comps.some((c) => norm(c.team?.displayName).includes(norm(bet.subject)));
  });
  if (!event) return;
  const comp = event.competitions[0];
  const me = (comp.competitors || []).find((c) => norm(c.team?.displayName).includes(norm(bet.subject)));
  const total = (comp.competitors || []).reduce((a, c) => a + (Number(c.score) || 0), 0);
  const finished = ["STATUS_FINAL", "STATUS_FULL_TIME"].includes(comp.status?.type?.name);
  const myScore = Number(me?.score) || 0;
  const oppScore = Number((comp.competitors.find((c) => c !== me) || {}).score) || 0;
  if (bet.metric === "team-win") {
    bet.target = 1;
    bet.current = me && myScore > oppScore ? 1 : 0;
    if (finished) bet.status = bet.current >= 1 ? "hit" : "miss";
  } else if (bet.metric === "spread" && bet.line != null && me) {
    bet.target = 1;
    const cover = myScore + Number(bet.line) > oppScore;
    bet.current = cover ? 1 : 0;
    if (finished) bet.status = cover ? "hit" : "miss";
  } else if (bet.metric === "total-over" && bet.line != null) {
    bet.target = Number(bet.line);
    bet.current = total;
    if (finished) bet.status = total > Number(bet.line) ? "hit" : "miss";
  } else if (bet.metric === "total-under" && bet.line != null) {
    bet.target = 1;
    bet.current = finished && total < Number(bet.line) ? 1 : 0;
    if (finished) bet.status = total < Number(bet.line) ? "hit" : "miss";
  }
  bet.lastSync = new Date().toISOString();
}

async function main() {
  const bets = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const bet of bets) {
    if (bet.template) continue;
    try {
      if (bet.kind === "record") await refreshRecord(bet);
      else if (bet.kind === "game") await refreshGame(bet);
      else await refreshPlayer(bet);
    } catch (e) {
      console.warn(bet.id || bet.desc, e.message);
    }
  }
  fs.writeFileSync(file, JSON.stringify(bets, null, 2) + "\n");
}

main();
