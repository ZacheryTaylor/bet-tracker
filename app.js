const SPORTS = [
  { id: "nfl", label: "NFL", path: "football/nfl", standings: "football/nfl", athlete: "football/nfl" },
  { id: "ncaaf", label: "College football", path: "football/college-football", standings: "football/college-football", athlete: "football/college-football" },
  { id: "nba", label: "NBA", path: "basketball/nba", standings: "basketball/nba", athlete: "basketball/nba" },
  { id: "ncaab", label: "College basketball", path: "basketball/mens-college-basketball", standings: "basketball/mens-college-basketball", athlete: "basketball/mens-college-basketball" },
  { id: "mlb", label: "MLB", path: "baseball/mlb", standings: "baseball/mlb", athlete: "baseball/mlb" },
  { id: "nhl", label: "NHL", path: "hockey/nhl", standings: "hockey/nhl", athlete: "hockey/nhl" },
  { id: "soccer", label: "Soccer (MLS)", path: "soccer/usa.1", standings: null, athlete: null },
  { id: "other", label: "Other", path: null, standings: null, athlete: null }
];

const STAT_NAMES = {
  passingYards: ["passingYards", "passingYds", "netPassingYards"],
  passingTouchdowns: ["passingTouchdowns", "passingTDs"],
  rushingYards: ["rushingYards"],
  rushingTouchdowns: ["rushingTouchdowns", "rushingTDs"],
  receivingYards: ["receivingYards"],
  receptions: ["receptions", "receivingReceptions"],
  receivingTouchdowns: ["receivingTouchdowns"],
  points: ["points", "avgPoints", "totalPoints"],
  rebounds: ["rebounds", "avgRebounds"],
  assists: ["assists", "avgAssists"],
  threePointers: ["threePointFieldGoalsMade", "threePointersMade"],
  homeRuns: ["homeRuns"],
  rbi: ["RBIs", "rbi"],
  battingAverage: ["avg", "battingAverage"],
  strikeouts: ["strikeouts"],
  goals: ["goals"],
  saves: ["saves"],
  wins: ["wins"]
};

const $ = (id) => document.getElementById(id);
let bets = [];

function normalizeBets(data) {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (!data || typeof data !== "object") return [];
  if (data.kind) return [data];
  const out = [];
  for (const key of ["playerProp", "teamRecord", "game"]) {
    if (data[key] && typeof data[key] === "object") out.push(data[key]);
  }
  if (out.length) return out;
  return Object.values(data).filter((v) => v && typeof v === "object" && v.kind);
}

function sportLabel(id) {
  return (SPORTS.find((s) => s.id === id) || {}).label || id;
}
function kindLabel(kind) {
  if (kind === "record") return "Team record";
  if (kind === "game") return "Game";
  return "Player prop";
}
function pct(bet) {
  const t = Number(bet.target) || 1;
  const c = Number(bet.current) || 0;
  return Math.max(0, Math.min(100, (c / t) * 100));
}
function solidColor(p) {
  const x = Math.max(0, Math.min(100, p)) / 100;
  let r, g, b;
  if (x < 0.5) {
    const t = x / 0.5;
    r = 192; g = Math.round(57 + t * (196 - 57)); b = Math.round(43 + t * (15 - 43));
  } else {
    const t = (x - 0.5) / 0.5;
    r = Math.round(241 + t * (39 - 241)); g = Math.round(196 + t * (174 - 196)); b = Math.round(15 + t * (96 - 15));
  }
  return `rgb(${r}, ${g}, ${b})`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fillSports() {
  $("filterSport").innerHTML = `<option value="all">All sports</option>` +
    SPORTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
}

function render() {
  const sport = $("filterSport").value;
  const kind = $("filterType").value;
  const timeline = $("filterTimeline").value;
  const status = $("filterStatus").value;
  const filtered = bets.filter((b) => {
    if (!b || b.template) return false;
    const k = b.kind || "player-prop";
    if (sport !== "all" && b.sport !== sport) return false;
    if (kind !== "all" && k !== kind) return false;
    if (timeline !== "all" && b.timeline !== timeline) return false;
    if (status !== "all" && b.status !== status) return false;
    return true;
  });
  $("statusLine").textContent = `${filtered.length} bet(s)`;
  $("betList").innerHTML = filtered.map((b) => {
    const p = pct(b);
    const k = b.kind || "player-prop";
    const record = k === "record"
      ? `${Number(b.current) || 0}-${Number(b.losses) || 0}`
      : `${Number(b.current)} / ${Number(b.target)}`;
    return `<article class="card">
      <div class="card-top">
        <div>
          <p class="title">${escapeHtml(b.desc || "Untitled bet")}</p>
          <p class="meta">${escapeHtml(b.subject || "")}${b.stat ? " · " + escapeHtml(b.stat) : ""}${b.date ? " · " + b.date : ""}${b.lastSync ? " · synced " + b.lastSync : ""}</p>
        </div>
        <div class="chips">
          <span class="chip">${sportLabel(b.sport)}</span>
          <span class="chip">${kindLabel(k)}</span>
          <span class="chip">${b.timeline === "single" ? "Single game" : "Season long"}</span>
          <span class="chip">${b.status || "open"}</span>
        </div>
      </div>
      <div class="bar"><span style="width:${p}%;background:${solidColor(p)}"></span></div>
      <p class="meta">${p.toFixed(0)}% · ${record}${k === "record" ? " · target " + Number(b.target) + " wins" : ""}</p>
    </article>`;
  }).join("") || `<p class="meta">No bets found. data/bets.json should look like [ { ...bet } ].</p>`;
}

async function loadBets() {
  const urls = [
    `https://raw.githubusercontent.com/ZacheryTaylor/bet-tracker/main/data/bets.json?t=${Date.now()}`,
    `data/bets.json?t=${Date.now()}`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      bets = normalizeBets(await res.json());
      render();
      return;
    } catch (e) {
      console.warn(e);
    }
  }
  bets = [];
  $("statusLine").textContent = "Could not load data/bets.json";
  render();
}

async function loadTemplates() {
  try {
    const res = await fetch(`data/templates.json?t=${Date.now()}`);
    const t = await res.json();
    if ($("tplPlayer")) $("tplPlayer").textContent = JSON.stringify([t.playerProp], null, 2);
    if ($("tplTeam")) $("tplTeam").textContent = JSON.stringify([t.teamRecord], null, 2);
  } catch {
    if ($("tplPlayer")) $("tplPlayer").textContent = "See data/templates.json";
    if ($("tplTeam")) $("tplTeam").textContent = "See data/templates.json";
  }
}

function walkValues(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walkValues(n, fn)); return; }
  fn(node);
  Object.values(node).forEach((v) => walkValues(v, fn));
}

function extractStat(data, stat) {
  const names = STAT_NAMES[stat] || [stat];
  const hits = [];
  walkValues(data, (obj) => {
    const n = String(obj.name || obj.abbreviation || "");
    if (obj.value == null && obj.displayValue == null) return;
    if (names.some((x) => n.toLowerCase() === x.toLowerCase())) {
      const v = Number(obj.value != null ? obj.value : obj.displayValue);
      if (!Number.isNaN(v)) hits.push(v);
    }
  });
  return hits.length ? hits[hits.length - 1] : null;
}

async function resolveAthleteId(bet) {
  if (bet.espnAthleteId) return bet.espnAthleteId;
  const q = encodeURIComponent(bet.subject || "");
  const res = await fetch(`https://site.web.api.espn.com/apis/common/v3/search?query=${q}&limit=8`);
  if (!res.ok) return null;
  const data = await res.json();
  let id = null;
  walkValues(data, (obj) => {
    if (id) return;
    if (obj.id && norm(obj.displayName || obj.fullName).includes(norm(bet.subject))) id = String(obj.id);
  });
  return id;
}

async function refreshPlayer(bet) {
  const sport = SPORTS.find((s) => s.id === bet.sport);
  const id = await resolveAthleteId(bet);
  if (!sport || !id || !bet.stat) return false;
  const year = new Date().getFullYear();
  const urls = [
    `https://site.web.api.espn.com/apis/common/v3/sports/${sport.athlete}/athletes/${id}/stats?season=${year}&seasontype=2`,
    `https://site.web.api.espn.com/apis/common/v3/sports/${sport.athlete}/athletes/${id}/overview`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const value = extractStat(await res.json(), bet.stat);
      if (value == null) continue;
      bet.current = value;
      bet.espnAthleteId = id;
      bet.lastSync = new Date().toLocaleString();
      if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit";
      return true;
    } catch (e) {
      console.warn(e);
    }
  }
  return false;
}

function walkTeams(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) { node.forEach((n) => walkTeams(n, acc)); return acc; }
  if (node.team && (node.stats || node.team.record)) acc.push(node);
  ["children", "standings", "entries"].forEach((k) => walkTeams(node[k], acc));
  return acc;
}

function recordFromEntry(entry) {
  const stats = entry.stats || [];
  const wins = Number((stats.find((s) => s.name === "wins") || {}).value);
  const losses = Number((stats.find((s) => s.name === "losses") || {}).value);
  if (!Number.isNaN(wins) || !Number.isNaN(losses)) return { wins: wins || 0, losses: losses || 0 };
  const summary = entry.team?.record?.items?.[0]?.summary || "";
  const m = summary.match(/^(\d+)-(\d+)/);
  return m ? { wins: Number(m[1]), losses: Number(m[2]) } : null;
}

function findCompetitor(event, query) {
  const q = norm(query);
  if (!q) return null;
  const comps = event.competitions?.[0]?.competitors || [];
  return comps.find((c) => {
    const names = [c.team?.displayName, c.team?.shortDisplayName, c.team?.abbreviation, c.team?.name, c.team?.nickname];
    return names.some((n) => norm(n).includes(q) || q.includes(norm(n)));
  }) || null;
}

async function refreshRecord(bet) {
  const sport = SPORTS.find((s) => s.id === bet.sport);
  if (!sport?.standings) return false;
  const res = await fetch(`https://site.api.espn.com/apis/v2/sports/${sport.standings}/standings`);
  if (!res.ok) return false;
  const q = norm(bet.subject);
  const entry = walkTeams(await res.json()).find((en) => {
    const names = [en.team?.displayName, en.team?.shortDisplayName, en.team?.abbreviation, en.team?.name, en.team?.nickname, en.team?.location];
    return names.some((n) => q && (norm(n).includes(q) || q.includes(norm(n))));
  });
  const rec = entry && recordFromEntry(entry);
  if (!rec) return false;
  bet.current = rec.wins;
  bet.losses = rec.losses;
  bet.lastSync = new Date().toLocaleString();
  if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit";
  return true;
}

async function refreshGame(bet) {
  const sport = SPORTS.find((s) => s.id === bet.sport);
  if (!sport?.path) return false;
  const dates = (bet.date || "").replaceAll("-", "");
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.path}/scoreboard${dates ? "?dates=" + dates : ""}`);
  if (!res.ok) return false;
  const event = ((await res.json()).events || []).find((ev) => findCompetitor(ev, bet.subject));
  if (!event) return false;
  const comp = event.competitions?.[0];
  const me = findCompetitor(event, bet.subject);
  const total = (comp.competitors || []).reduce((a, c) => a + (Number(c.score) || 0), 0);
  const finished = ["STATUS_FINAL", "STATUS_FULL_TIME"].includes(comp.status?.type?.name);
  const myScore = me ? Number(me.score) || 0 : 0;
  const opp = me ? comp.competitors.find((c) => c.id !== me.id) : null;
  const oppScore = opp ? Number(opp.score) || 0 : 0;
  if (bet.metric === "team-win") {
    bet.target = 1;
    bet.current = me && myScore > oppScore ? 1 : 0;
    if (finished) bet.status = bet.current >= 1 ? "hit" : "miss";
  } else if (bet.metric === "spread" && bet.line != null && me) {
    bet.target = 1;
    bet.current = myScore + Number(bet.line) > oppScore ? 1 : 0;
    if (finished) bet.status = bet.current >= 1 ? "hit" : "miss";
  } else if (bet.metric === "total-over" && bet.line != null) {
    bet.target = Number(bet.line);
    bet.current = total;
    if (finished) bet.status = total > Number(bet.line) ? "hit" : "miss";
  } else if (bet.metric === "total-under" && bet.line != null) {
    bet.target = 1;
    bet.current = finished && total < Number(bet.line) ? 1 : 0;
    if (finished) bet.status = total < Number(bet.line) ? "hit" : "miss";
  }
  bet.lastSync = new Date().toLocaleString();
  return true;
}

$("refreshBtn").addEventListener("click", async () => {
  $("refreshBtn").disabled = true;
  $("statusLine").textContent = "Refreshing ESPN…";
  let n = 0;
  for (const bet of bets) {
    if (!bet || bet.template) continue;
    try {
      const ok = bet.kind === "record" ? await refreshRecord(bet)
        : bet.kind === "game" ? await refreshGame(bet)
        : await refreshPlayer(bet);
      if (ok) n += 1;
    } catch (e) {
      console.warn(e);
    }
  }
  render();
  $("refreshBtn").disabled = false;
  $("statusLine").textContent = `Updated ${n} bet(s) from ESPN.`;
});

["filterSport", "filterType", "filterTimeline", "filterStatus"].forEach((id) => {
  $(id).addEventListener("change", render);
});

fillSports();
loadTemplates();
loadBets();
