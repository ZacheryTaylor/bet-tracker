const SPORTS = [
  { id: "nfl", label: "NFL", path: "football/nfl", standings: "football/nfl", athlete: "football/nfl" },
  { id: "ncaaf", label: "College football", path: "football/college-football", standings: "football/college-football", athlete: "football/college-football" },
  { id: "nba", label: "NBA", path: "basketball/nba", standings: "basketball/nba", athlete: "basketball/nba" },
  { id: "mlb", label: "MLB", path: "baseball/mlb", standings: "baseball/mlb", athlete: "baseball/mlb" },
  { id: "nhl", label: "NHL", path: "hockey/nhl", standings: "hockey/nhl", athlete: "hockey/nhl" },
  { id: "other", label: "Other", path: null, standings: null, athlete: null }
];

const STAT_MATCH = {
  passingYards: { cats: ["passing"], names: ["passingyards", "passingyds", "netpassingyards", "yds"] },
  passingTouchdowns: { cats: ["passing"], names: ["passingtouchdowns", "passingtds", "td"] },
  rushingYards: { cats: ["rushing"], names: ["rushingyards", "rushingyds", "yds"] },
  rushingTouchdowns: { cats: ["rushing"], names: ["rushingtouchdowns", "rushingtds", "td"] },
  receivingYards: { cats: ["receiving"], names: ["receivingyards", "receivingyds", "yds"] },
  receptions: { cats: ["receiving"], names: ["receptions", "rec"] },
  receivingTouchdowns: { cats: ["receiving"], names: ["receivingtouchdowns", "receivingtds", "td"] }
};

const $ = (id) => document.getElementById(id);
let bets = [];

function normalizeBets(data) {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (!data || typeof data !== "object") return [];
  if (data.kind) return [data];
  return Object.values(data).filter((v) => v && v.kind);
}
function sportLabel(id) {
  return (SPORTS.find((s) => s.id === id) || {}).label || id;
}
function kindLabel(kind) {
  return { record: "Team record", game: "Game", parlay: "Parlay", award: "Award" }[kind] || "Player prop";
}
function pct(bet) {
  const t = Number(bet.target) || 1;
  return Math.max(0, Math.min(100, ((Number(bet.current) || 0) / t) * 100));
}
function parlayPct(bet) {
  const legs = bet.legs || [];
  if (!legs.length) return 0;
  return legs.reduce((s, l) => s + pct(l), 0) / legs.length;
}
function solidColor(p) {
  const x = Math.max(0, Math.min(100, p)) / 100;
  let r, g, b;
  if (x < 0.5) {
    const t = x / 0.5;
    r = 192; g = Math.round(57 + t * 139); b = Math.round(43 - t * 28);
  } else {
    const t = (x - 0.5) / 0.5;
    r = Math.round(241 - t * 202); g = Math.round(196 - t * 22); b = Math.round(15 + t * 81);
  }
  return `rgb(${r}, ${g}, ${b})`;
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function compact(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function bar(p, small) {
  return `<div class="bar${small ? " small" : ""}"><span style="width:${p}%;background:${solidColor(p)}"></span></div>`;
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
    if (status !== "all" && (b.status || "open") !== status) return false;
    return true;
  });
  $("statusLine").textContent = `${filtered.length} bet(s)`;
  $("betList").innerHTML = filtered.map((b) => {
    const k = b.kind || "player-prop";
    const p = k === "parlay" ? parlayPct(b) : pct(b);
    const money = b.notes || (b.stake != null ? `$${b.stake} → $${b.payout}` : "");
    const summary = k === "record"
      ? `${Number(b.current) || 0}-${Number(b.losses) || 0} · target ${Number(b.target)} wins`
      : k === "parlay"
        ? `${(b.legs || []).length} legs · all must hit`
        : `${Number(b.current) || 0} / ${Number(b.target)}`;
    const legs = k === "parlay" ? `<div class="legs">${(b.legs || []).map((leg) => {
      const lp = pct(leg);
      return `<div class="leg">
        <p class="leg-title">${escapeHtml(leg.subject)} · ${escapeHtml(leg.stat || "")}</p>
        ${bar(lp, true)}
        <p class="meta">${lp.toFixed(0)}% · ${Number(leg.current) || 0} / ${Number(leg.target)}${leg.lastSync ? " · " + escapeHtml(leg.lastSync) : ""}</p>
      </div>`;
    }).join("")}</div>` : "";
    return `<article class="card">
      <div class="card-top">
        <div>
          <p class="title">${escapeHtml(b.desc)}</p>
          <p class="meta">${escapeHtml(b.subject || "")}${money ? " · " + escapeHtml(money) : ""}${b.lastSync ? " · " + escapeHtml(b.lastSync) : ""}</p>
        </div>
        <div class="chips">
          <span class="chip">${sportLabel(b.sport)}</span>
          <span class="chip">${kindLabel(k)}</span>
          <span class="chip">${b.timeline === "single" ? "Single game" : "Season long"}</span>
          <span class="chip">${b.status || "open"}</span>
        </div>
      </div>
      ${bar(p)}
      <p class="meta">${p.toFixed(0)}% · ${summary}</p>
      ${legs}
    </article>`;
  }).join("") || `<p class="meta">No bets found.</p>`;
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
    } catch (e) { console.warn(e); }
  }
  $("statusLine").textContent = "Could not load data/bets.json";
}

function walk(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, fn)); return; }
  fn(node);
  Object.values(node).forEach((v) => walk(v, fn));
}

function extractStat(data, stat) {
  const cfg = STAT_MATCH[stat] || { cats: [], names: [compact(stat)] };
  const hits = [];
  walk(data, (obj) => {
    const cat = compact(obj.displayName || obj.name || obj.abbreviation || "");
    if (!obj.stats && obj.value == null && obj.displayValue == null) return;
    if (Array.isArray(obj.stats)) {
      const catOk = !cfg.cats.length || cfg.cats.some((c) => cat.includes(c));
      if (!catOk && cfg.cats.length) return;
      obj.stats.forEach((st) => {
        const n = compact(st.name || st.abbreviation || st.displayName);
        if (cfg.names.includes(n) || n === compact(stat)) {
          const v = Number(st.value != null ? st.value : st.displayValue);
          if (!Number.isNaN(v)) hits.push(v);
        }
      });
    }
  });
  if (hits.length) return hits[hits.length - 1];
  walk(data, (obj) => {
    const n = compact(obj.name || obj.displayName);
    if (n === compact(stat) && (obj.value != null || obj.displayValue != null)) {
      const v = Number(obj.value != null ? obj.value : obj.displayValue);
      if (!Number.isNaN(v)) hits.push(v);
    }
  });
  return hits.length ? hits[hits.length - 1] : null;
}

function isNflAthlete(obj) {
  const blob = JSON.stringify(obj).toLowerCase();
  return blob.includes("nfl") || blob.includes("s:20") || blob.includes("football/nfl");
}

async function resolveAthleteId(bet) {
  if (bet.espnAthleteId) return String(bet.espnAthleteId);
  const sport = SPORTS.find((s) => s.id === (bet.sport || "nfl"));
  const q = encodeURIComponent(bet.subject || "");
  const urls = [
    `https://site.web.api.espn.com/apis/common/v3/search?query=${q}&limit=15`,
    `https://site.api.espn.com/apis/site/v2/sports/${sport?.athlete || "football/nfl"}/athletes?limit=20`
  ];
  const want = norm(bet.subject);
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      let id = null;
      walk(data, (obj) => {
        if (id) return;
        const name = norm(obj.displayName || obj.fullName || obj.name);
        if (!obj.id || !name) return;
        if (!(name === want || name.includes(want) || want.includes(name))) return;
        if ((bet.sport || "nfl") === "nfl" && !isNflAthlete(obj) && url.includes("search")) return;
        id = String(obj.id).replace(/\D/g, "") || String(obj.id);
      });
      if (id) return id;
    } catch (e) { console.warn(e); }
  }
  return null;
}

async function refreshPlayer(bet) {
  if (bet.kind === "award") return false;
  const sport = SPORTS.find((s) => s.id === (bet.sport || "nfl"));
  if (!sport?.athlete || !bet.stat) return false;
  const id = await resolveAthleteId(bet);
  if (!id) return false;
  const year = new Date().getFullYear();
  const urls = [
    `https://site.web.api.espn.com/apis/common/v3/sports/${sport.athlete}/athletes/${id}/stats?season=${year}&seasontype=2`,
    `https://site.web.api.espn.com/apis/common/v3/sports/${sport.athlete}/athletes/${id}/splits?season=${year}`,
    `https://site.web.api.espn.com/apis/common/v3/sports/${sport.athlete}/athletes/${id}/overview`,
    `https://sports.core.api.espn.com/v2/sports/${sport.athlete.replace("/", "/leagues/")}/seasons/${year}/types/2/athletes/${id}/statistics`
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
    } catch (e) { console.warn(e); }
  }
  return false;
}

function walkTeams(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) { node.forEach((n) => walkTeams(n, acc)); return acc; }
  if (node.team && (node.stats || node.team.record)) acc.push(node);
  ["children", "standings", "entries"].forEach((k) => { if (node[k]) walkTeams(node[k], acc); });
  return acc;
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
  if (!entry) return false;
  const stats = entry.stats || [];
  const wins = Number((stats.find((s) => s.name === "wins") || {}).value);
  const losses = Number((stats.find((s) => s.name === "losses") || {}).value);
  if (!Number.isNaN(wins)) bet.current = wins;
  if (!Number.isNaN(losses)) bet.losses = losses;
  bet.lastSync = new Date().toLocaleString();
  if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit";
  return true;
}

async function refreshOne(bet) {
  if (!bet || bet.template) return false;
  if (bet.kind === "parlay") {
    let any = false;
    for (const leg of bet.legs || []) {
      leg.sport = leg.sport || bet.sport || "nfl";
      leg.kind = "player-prop";
      if (await refreshPlayer(leg)) any = true;
    }
    if (any) {
      const legs = bet.legs || [];
      if (legs.length && legs.every((l) => pct(l) >= 100)) bet.status = "hit";
      bet.lastSync = new Date().toLocaleString();
    }
    return any;
  }
  if (bet.kind === "record") return refreshRecord(bet);
  if (bet.kind === "award") return false;
  return refreshPlayer(bet);
}

$("refreshBtn").addEventListener("click", async () => {
  $("refreshBtn").disabled = true;
  $("statusLine").textContent = "Refreshing ESPN…";
  let n = 0;
  const missed = [];
  for (const bet of bets) {
    try {
      if (await refreshOne(bet)) n += 1;
      else if (bet.kind !== "award") missed.push(bet.desc || bet.subject || bet.id);
    } catch (e) {
      missed.push((bet.desc || bet.id) + " (" + e.message + ")");
    }
  }
  render();
  $("refreshBtn").disabled = false;
  $("statusLine").textContent = `Updated ${n} bet(s).` + (missed.length ? ` No ESPN match yet: ${missed.slice(0, 6).join("; ")}${missed.length > 6 ? "…" : ""}` : "");
});

["filterSport", "filterType", "filterTimeline", "filterStatus"].forEach((id) => {
  $(id).addEventListener("change", render);
});

fillSports();
loadBets();
