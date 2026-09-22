const SPORTS = [
  { id: "nfl", label: "NFL" },
  { id: "ncaaf", label: "College football" },
  { id: "nba", label: "NBA" },
  { id: "mlb", label: "MLB" },
  { id: "nhl", label: "NHL" },
  { id: "other", label: "Other" }
];

const $ = (id) => document.getElementById(id);
let bets = [];

function normalizeBets(data) {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (!data || typeof data !== "object") return [];
  if (data.kind) return [data];
  return Object.values(data).filter((v) => v && v.kind);
}
function sportLabel(id) { return (SPORTS.find((sport) => sport.id === id) || {}).label || id; }
function kindLabel(kind) { return { record: "Team record", parlay: "Parlay", award: "Award", game: "Game" }[kind] || "Player prop"; }
function pct(bet) { const target = Number(bet.target) || 1; return Math.max(0, Math.min(100, ((Number(bet.current) || 0) / target) * 100)); }
function parlayPct(bet) { const legs = bet.legs || []; return legs.length ? legs.reduce((sum, leg) => sum + pct(leg), 0) / legs.length : 0; }
function solidColor(p) {
  const x = Math.max(0, Math.min(100, p)) / 100;
  let r, g, b;
  if (x < 0.5) { const t = x / 0.5; r = 192; g = Math.round(57 + t * 139); b = Math.round(43 - t * 28); }
  else { const t = (x - 0.5) / 0.5; r = Math.round(241 - t * 202); g = Math.round(196 - t * 22); b = Math.round(15 + t * 81); }
  return `rgb(${r}, ${g}, ${b})`;
}
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function bar(p, small = false) { return `<div class="bar${small ? " small" : ""}"><span style="width:${p}%;background:${solidColor(p)}"></span></div>`; }

function fillSports() {
  $("filterSport").innerHTML = `<option value="all">All sports</option>` + SPORTS.map((sport) => `<option value="${sport.id}">${sport.label}</option>`).join("");
}
function fillUsers() {
  const selected = $("filterUser").value || "all";
  const users = [...new Set(bets.map((bet) => bet.user || "Unassigned"))].sort();
  $("filterUser").innerHTML = `<option value="all">All users</option>` + users.map((user) => `<option value="${escapeHtml(user)}">${escapeHtml(user)}</option>`).join("");
  $("filterUser").value = users.includes(selected) ? selected : "all";
}

function render() {
  const user = $("filterUser").value;
  const sport = $("filterSport").value;
  const kind = $("filterType").value;
  const timeline = $("filterTimeline").value;
  const status = $("filterStatus").value;
  const filtered = bets.filter((bet) => {
    if (!bet || bet.template) return false;
    if (user !== "all" && (bet.user || "Unassigned") !== user) return false;
    if (sport !== "all" && bet.sport !== sport) return false;
    if (kind !== "all" && (bet.kind || "player-prop") !== kind) return false;
    if (timeline !== "all" && bet.timeline !== timeline) return false;
    if (status !== "all" && (bet.status || "open") !== status) return false;
    return true;
  });
  $("statusLine").textContent = `${filtered.length} bet(s)`;
  $("betList").innerHTML = filtered.map((bet) => {
    const kind = bet.kind || "player-prop";
    const progress = kind === "parlay" ? parlayPct(bet) : pct(bet);
    const money = bet.notes || "";
    const summary = kind === "record"
      ? `${Number(bet.current) || 0}-${Number(bet.losses) || 0}${Number(bet.ties) ? `-${Number(bet.ties)}` : ""} · target ${Number(bet.target)} wins`
      : kind === "parlay" ? `${(bet.legs || []).length} legs · all must hit` : `${Number(bet.current) || 0} / ${Number(bet.target)}`;
    const legs = kind === "parlay" ? `<div class="legs">${(bet.legs || []).map((leg) => {
      const legProgress = pct(leg);
      return `<div class="leg"><p class="leg-title">${escapeHtml(leg.subject)} · ${escapeHtml(leg.stat || "")}</p>${bar(legProgress, true)}<p class="meta">${legProgress.toFixed(0)}% · ${Number(leg.current) || 0} / ${Number(leg.target)}</p></div>`;
    }).join("")}</div>` : "";
    return `<article class="card"><div class="card-top"><div><p class="title">${escapeHtml(bet.desc)}</p><p class="meta">${escapeHtml(bet.subject || "")}${money ? " · " + escapeHtml(money) : ""}</p></div><div class="chips"><span class="chip">${escapeHtml(bet.user || "Unassigned")}</span><span class="chip">${sportLabel(bet.sport)}</span><span class="chip">${kindLabel(kind)}</span><span class="chip">${bet.status || "open"}</span></div></div>${bar(progress)}<p class="meta">${progress.toFixed(0)}% · ${summary}</p>${legs}</article>`;
  }).join("") || `<p class="meta">No bets found.</p>`;
}

async function loadBets() {
  const urls = [`https://raw.githubusercontent.com/ZacheryTaylor/bet-tracker/main/data/bets.json?t=${Date.now()}`, `data/bets.json?t=${Date.now()}`];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      bets = normalizeBets(await response.json());
      fillUsers();
      render();
      return;
    } catch (error) { console.warn(error); }
  }
  $("statusLine").textContent = "Could not load data/bets.json";
}

async function refreshRecord(bet) {
  if (!window.TeamRecord) throw new Error("Team record helper did not load");
  const response = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings");
  if (!response.ok) throw new Error(`Standings ${response.status}`);
  const record = window.TeamRecord.findOverallRecord(await response.json(), bet.subject);
  if (!record) throw new Error(`No overall record found for ${bet.subject}`);
  bet.current = record.wins; bet.losses = record.losses; bet.ties = record.ties;
  if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit";
  return true;
}
async function refreshOne(bet) {
  if (!bet || bet.kind === "award") return false;
  if (bet.kind === "record") return refreshRecord(bet);
  if (bet.kind === "parlay") {
    let updated = false;
    for (const leg of bet.legs || []) { leg.sport = leg.sport || bet.sport || "nfl"; if (await window.EspnPlayer.refreshPlayer(leg)) updated = true; }
    if (updated && (bet.legs || []).every((leg) => pct(leg) >= 100)) bet.status = "hit";
    return updated;
  }
  return window.EspnPlayer.refreshPlayer(bet);
}
$("refreshBtn").addEventListener("click", async () => {
  if (!window.EspnPlayer || !window.TeamRecord) { $("statusLine").textContent = "Refresh helpers failed to load."; return; }
  $("refreshBtn").disabled = true; $("statusLine").textContent = "Refreshing ESPN…";
  let updated = 0; const missed = [];
  for (const bet of bets) {
    try { if (await refreshOne(bet)) updated += 1; else if (bet.kind !== "award") missed.push(bet.desc || bet.subject || bet.id); }
    catch (_) { missed.push(bet.desc || bet.subject || bet.id); }
  }
  render(); $("refreshBtn").disabled = false;
  $("statusLine").textContent = `Updated ${updated} bet(s).` + (missed.length ? ` Still empty: ${missed.slice(0, 8).join("; ")}` : "");
});
["filterUser", "filterSport", "filterType", "filterTimeline", "filterStatus"].forEach((id) => $(id).addEventListener("change", render));
fillSports();
loadBets();
