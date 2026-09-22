const SPORTS = [
  { id: "nfl", label: "NFL" },
  { id: "ncaaf", label: "College football" },
  { id: "nba", label: "NBA" },
  { id: "mlb", label: "MLB" },
  { id: "nhl", label: "NHL" },
  { id: "other", label: "Other" }
];

const DEFAULT_SEASON_GAMES = { nfl: 17, ncaaf: 12, nba: 82, mlb: 162, nhl: 82 };
const $ = (id) => document.getElementById(id);
let bets = [];

function normalizeBets(data) {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (!data || typeof data !== "object") return [];
  if (data.kind) return [data];
  return Object.values(data).filter((value) => value && value.kind);
}
function sportLabel(id) { return (SPORTS.find((sport) => sport.id === id) || {}).label || id; }
function kindLabel(kind) { return { record: "Team record", parlay: "Parlay", award: "Award", game: "Game", future: "Future" }[kind] || "Player prop"; }
function pct(bet) {
  const target = Number(bet.target) || 1;
  return Math.max(0, Math.min(100, ((Number(bet.current) || 0) / target) * 100));
}
function parlayPct(bet) {
  const legs = bet.legs || [];
  return legs.length ? legs.reduce((sum, leg) => sum + pct(leg), 0) / legs.length : 0;
}
function solidColor(p) {
  const x = Math.max(0, Math.min(100, p)) / 100;
  let r, g, b;
  if (x < 0.5) { const t = x / 0.5; r = 192; g = Math.round(57 + t * 139); b = Math.round(43 - t * 28); }
  else { const t = (x - 0.5) / 0.5; r = Math.round(241 - t * 202); g = Math.round(196 - t * 22); b = Math.round(15 + t * 81); }
  return `rgb(${r}, ${g}, ${b})`;
}
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function bar(p, small = false) { return `<div class="bar${small ? " small" : ""}"><span style="width:${p}%;background:${solidColor(p)}"></span></div>`; }
function currency(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0); }
function formatNumber(value) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(value) || 0); }

function selectedFilters() {
  return {
    user: $("filterUser").value,
    sport: $("filterSport").value,
    kind: $("filterType").value,
    timeline: $("filterTimeline").value,
    status: $("filterStatus").value
  };
}
function getFilteredBets() {
  const { user, sport, kind, timeline, status } = selectedFilters();
  return bets.filter((bet) => {
    if (!bet || bet.template) return false;
    if (user !== "all" && (bet.user || "Unassigned") !== user) return false;
    if (sport !== "all" && bet.sport !== sport) return false;
    if (kind !== "all" && (bet.kind || "player-prop") !== kind) return false;
    if (timeline !== "all" && bet.timeline !== timeline) return false;
    if (status !== "all" && (bet.status || "open") !== status) return false;
    return true;
  });
}

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
  const filtered = getFilteredBets();
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

function seasonGames(bet) {
  return Number(bet.seasonGames) || DEFAULT_SEASON_GAMES[bet.sport] || 17;
}
function isBinaryBet(bet) {
  return ["award", "future"].includes(bet.kind);
}
function reportEntriesForBet(bet) {
  if (isBinaryBet(bet)) return [];
  if (bet.kind === "parlay") {
    const legs = (bet.legs || []).filter((leg) => !isBinaryBet(leg));
    if (!legs.length) return [];
    const stakeShare = (Number(bet.stake) || 0) / legs.length;
    const payoutShare = (Number(bet.payout) || 0) / legs.length;
    return legs.map((leg, index) => ({ ...leg, id: `${bet.id}-leg-${index}`, parentId: bet.id, parentDesc: bet.desc, user: bet.user, stake: stakeShare, payout: payoutShare, isParlayLeg: true }));
  }
  return [bet];
}
function gamesPlayed(entry) {
  const explicit = Number(entry.gamesPlayed);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const current = Number(entry.current) || 0;
  if (!current) return 0;
  const sport = entry.sport || "nfl";
  const scheduleGames = seasonGames(entry);
  const now = new Date();
  const seasonStart = sport === "nfl" ? new Date(now.getFullYear(), 8, 1) : new Date(now.getFullYear(), 0, 1);
  const days = Math.max(0, (now - seasonStart) / 86400000);
  if (sport === "nfl" || sport === "ncaaf") return Math.max(1, Math.min(scheduleGames, Math.ceil(days / 7)));
  return Math.max(1, Math.min(scheduleGames, Math.ceil((days / 7) * (scheduleGames / 20))));
}
function reportMetric(entry) {
  const target = Number(entry.target) || 0;
  const current = Number(entry.current) || 0;
  if (!target) return null;
  const kind = entry.kind || "player-prop";
  const games = gamesPlayed(entry);
  const season = seasonGames(entry);
  const targetProgress = Math.max(0, Math.min(100, (current / target) * 100));
  const requiredPerGame = target / season;
  const actualPerGame = games ? current / games : 0;
  const paceRatio = games ? actualPerGame / requiredPerGame : 0;
  let weightedProgress;
  if (kind === "record") {
    weightedProgress = targetProgress;
  } else if (games === 0) {
    weightedProgress = 0;
  } else {
    const seasonElapsed = games / season;
    const paceScore = Math.max(0, Math.min(100, paceRatio * 100));
    weightedProgress = Math.max(0, Math.min(100, (targetProgress * 0.4) + (paceScore * 0.6)));
    if (seasonElapsed < 0.05) weightedProgress = targetProgress;
  }
  const payout = Number(entry.payout) || 0;
  const stake = Number(entry.stake) || 0;
  const impliedPayout = payout * (weightedProgress / 100);
  const impliedProfit = impliedPayout - stake;
  return { target, current, games, season, targetProgress, requiredPerGame, actualPerGame, paceRatio, weightedProgress, payout, stake, impliedPayout, impliedProfit };
}
function filterDescription() {
  const labels = [];
  const filters = selectedFilters();
  if (filters.user !== "all") labels.push(filters.user);
  if (filters.sport !== "all") labels.push(sportLabel(filters.sport));
  if (filters.kind !== "all") labels.push(kindLabel(filters.kind));
  if (filters.timeline !== "all") labels.push(filters.timeline === "season" ? "Season long" : "Single game");
  if (filters.status !== "all") labels.push(filters.status);
  return labels.length ? labels.join(" · ") : "All eligible bets";
}

function renderReport() {
  const filtered = getFilteredBets();
  const entries = filtered.flatMap(reportEntriesForBet).map((entry) => ({ entry, metric: reportMetric(entry) })).filter(({ metric }) => metric);
  $("reportPanel").hidden = false;
  $("reportTitle").textContent = filterDescription();
  if (!entries.length) {
    $("reportStats").innerHTML = `<div class="stat-box"><span>Eligible bets</span><strong>0</strong></div>`;
    $("reportPercent").textContent = "—";
    $("reportBar").style.width = "0%";
    $("reportBar").style.background = solidColor(0);
    $("reportNote").textContent = "No player props, team-win totals, or parlay legs match these filters. Binary award and future bets are excluded from pace reporting.";
    $("reportChart").innerHTML = "";
    return;
  }
  const totalStake = entries.reduce((sum, item) => sum + item.metric.stake, 0);
  const totalPayout = entries.reduce((sum, item) => sum + item.metric.payout, 0);
  const impliedValue = entries.reduce((sum, item) => sum + item.metric.impliedPayout, 0);
  const weighted = totalPayout > 0
    ? entries.reduce((sum, item) => sum + (item.metric.weightedProgress * item.metric.payout), 0) / totalPayout
    : entries.reduce((sum, item) => sum + item.metric.weightedProgress, 0) / entries.length;
  const hit = filtered.filter((bet) => bet.status === "hit").length;
  const open = filtered.filter((bet) => (bet.status || "open") === "open").length;
  $("reportStats").innerHTML = `
    <div class="stat-box"><span>Eligible entries</span><strong>${entries.length}</strong></div>
    <div class="stat-box"><span>Tickets included</span><strong>${filtered.length}</strong></div>
    <div class="stat-box"><span>Staked</span><strong>${currency(totalStake)}</strong></div>
    <div class="stat-box"><span>Implied payout value</span><strong>${currency(impliedValue)}</strong></div>`;
  $("reportPercent").textContent = `${weighted.toFixed(0)}%`;
  $("reportBar").style.width = `${weighted}%`;
  $("reportBar").style.background = solidColor(weighted);
  $("reportNote").textContent = `Payout-weighted pace score across ${entries.length} eligible prop/record entries. ${open} open and ${hit} hit ticket(s) in the selected view. Binary award and future bets are excluded.`;
  const rows = entries.sort((a, b) => b.metric.weightedProgress - a.metric.weightedProgress).map(({ entry, metric }) => {
    const name = entry.isParlayLeg ? `${entry.parentDesc}: ${entry.subject}` : (entry.desc || entry.subject);
    const paceText = entry.kind === "record"
      ? `${formatNumber(metric.current)} wins / ${formatNumber(metric.target)} target`
      : metric.games
        ? `${formatNumber(metric.actualPerGame)}/game vs ${formatNumber(metric.requiredPerGame)}/game needed`
        : `${formatNumber(metric.current)} / ${formatNumber(metric.target)}`;
    return `<div class="chart-item">
      <div class="chart-row"><span class="chart-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span><div class="chart-track"><div class="chart-fill" style="width:${metric.weightedProgress}%;background:${solidColor(metric.weightedProgress)}"></div></div><span class="chart-pct">${metric.weightedProgress.toFixed(0)}%</span></div>
      <p class="chart-detail">${escapeHtml(paceText)} · implied value ${currency(metric.impliedPayout)} of ${currency(metric.payout)}</p>
    </div>`;
  }).join("");
  $("reportChart").innerHTML = rows;
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
  if (!bet || ["award", "future"].includes(bet.kind)) return false;
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
    try { if (await refreshOne(bet)) updated += 1; else if (!["award", "future"].includes(bet.kind)) missed.push(bet.desc || bet.subject || bet.id); }
    catch (_) { missed.push(bet.desc || bet.subject || bet.id); }
  }
  render(); if (!$("reportPanel").hidden) renderReport();
  $("refreshBtn").disabled = false;
  $("statusLine").textContent = `Updated ${updated} bet(s).` + (missed.length ? ` Still empty: ${missed.slice(0, 8).join("; ")}` : "");
});
$("reportBtn").addEventListener("click", renderReport);
$("closeReportBtn").addEventListener("click", () => { $("reportPanel").hidden = true; });
["filterUser", "filterSport", "filterType", "filterTimeline", "filterStatus"].forEach((id) => $(id).addEventListener("change", () => { render(); if (!$("reportPanel").hidden) renderReport(); }));
fillSports();
loadBets();
