const SPORTS = [
  { id: "nfl", label: "NFL" }, { id: "ncaaf", label: "College football" }, { id: "nba", label: "NBA" }, { id: "mlb", label: "MLB" }, { id: "nhl", label: "NHL" }, { id: "other", label: "Other" }
];
const DEFAULT_SEASON_GAMES = { nfl: 17, ncaaf: 12, nba: 82, mlb: 162, nhl: 82 };
const $ = (id) => document.getElementById(id);
let bets = [];

function normalizeBets(data) { if (Array.isArray(data)) return data.filter(Boolean); if (!data || typeof data !== "object") return []; return data.kind ? [data] : Object.values(data).filter((v) => v && v.kind); }
function sportLabel(id) { return (SPORTS.find((s) => s.id === id) || {}).label || id || "Other"; }
function kindLabel(kind) { return { record: "Team record", parlay: "Parlay", award: "Award", game: "Game", future: "Future" }[kind] || "Player prop"; }
function pct(bet) { const target = Number(bet?.target) || 1; return Math.max(0, Math.min(100, ((Number(bet?.current) || 0) / target) * 100)); }
function parlayPct(bet) { const legs = Array.isArray(bet?.legs) ? bet.legs : []; return legs.length ? legs.reduce((sum, leg) => sum + pct(leg), 0) / legs.length : 0; }
function solidColor(p) { const x = Math.max(0, Math.min(100, Number(p) || 0)) / 100; let r, g, b; if (x < .5) { const t = x / .5; r = 192; g = Math.round(57 + t * 139); b = Math.round(43 - t * 28); } else { const t = (x - .5) / .5; r = Math.round(241 - t * 202); g = Math.round(196 - t * 22); b = Math.round(15 + t * 81); } return `rgb(${r}, ${g}, ${b})`; }
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function currency(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0); }
function num(value) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(value) || 0); }
function bar(p, small = false) { return `<div class="bar${small ? " small" : ""}"><span style="width:${Math.max(0, Math.min(100, Number(p) || 0))}%;background:${solidColor(p)}"></span></div>`; }

function selectedFilters() { return { user: $("filterUser")?.value || "all", sport: $("filterSport")?.value || "all", kind: $("filterType")?.value || "all", timeline: $("filterTimeline")?.value || "all", status: $("filterStatus")?.value || "all" }; }
function getFilteredBets() {
  const f = selectedFilters();
  return bets.filter((bet) => bet && !bet.template && (f.user === "all" || (bet.user || "Unassigned") === f.user) && (f.sport === "all" || bet.sport === f.sport) && (f.kind === "all" || (bet.kind || "player-prop") === f.kind) && (f.timeline === "all" || bet.timeline === f.timeline) && (f.status === "all" || (bet.status || "open") === f.status));
}
function fillSports() { $("filterSport").innerHTML = `<option value="all">All sports</option>` + SPORTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join(""); }
function fillUsers() { const selected = $("filterUser").value || "all"; const users = [...new Set(bets.map((b) => b.user || "Unassigned"))].sort(); $("filterUser").innerHTML = `<option value="all">All users</option>` + users.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join(""); $("filterUser").value = users.includes(selected) ? selected : "all"; }

function render() {
  const filtered = getFilteredBets();
  $("statusLine").textContent = `${filtered.length} bet(s)`;
  $("betList").innerHTML = filtered.map((bet) => {
    const kind = bet.kind || "player-prop"; const progress = kind === "parlay" ? parlayPct(bet) : pct(bet); const money = bet.notes || "";
    const summary = kind === "record" ? `${Number(bet.current) || 0}-${Number(bet.losses) || 0}${Number(bet.ties) ? `-${Number(bet.ties)}` : ""} · target ${Number(bet.target)} wins` : kind === "parlay" ? `${(bet.legs || []).length} legs · all must hit` : `${Number(bet.current) || 0} / ${Number(bet.target)}`;
    const legs = kind === "parlay" ? `<div class="legs">${(bet.legs || []).map((leg) => { const p = pct(leg); return `<div class="leg"><p class="leg-title">${escapeHtml(leg.subject)} · ${escapeHtml(leg.stat || "")}</p>${bar(p, true)}<p class="meta">${p.toFixed(0)}% · ${Number(leg.current) || 0} / ${Number(leg.target)}</p></div>`; }).join("")}</div>` : "";
    return `<article class="card"><div class="card-top"><div><p class="title">${escapeHtml(bet.desc)}</p><p class="meta">${escapeHtml(bet.subject || "")}${money ? " · " + escapeHtml(money) : ""}</p></div><div class="chips"><span class="chip">${escapeHtml(bet.user || "Unassigned")}</span><span class="chip">${sportLabel(bet.sport)}</span><span class="chip">${kindLabel(kind)}</span><span class="chip">${bet.status || "open"}</span></div></div>${bar(progress)}<p class="meta">${progress.toFixed(0)}% · ${summary}</p>${legs}</article>`;
  }).join("") || `<p class="meta">No bets found.</p>`;
}

function isBinary(bet) { return ["award", "future"].includes(bet?.kind); }
function seasonGames(entry) { return Number(entry?.seasonGames) || DEFAULT_SEASON_GAMES[entry?.sport] || 17; }
function reportEntries(bet) {
  if (isBinary(bet)) return [];
  if (bet.kind !== "parlay") return [bet];
  const legs = Array.isArray(bet.legs) ? bet.legs : [];
  const usable = legs.filter((leg) => !isBinary(leg));
  const stakeShare = (Number(bet.stake) || 0) / (usable.length || 1);
  const payoutShare = (Number(bet.payout) || 0) / (usable.length || 1);
  return usable.map((leg, i) => ({ ...leg, id: `${bet.id}-leg-${i}`, parentDesc: bet.desc || "Parlay", isParlayLeg: true, stake: stakeShare, payout: payoutShare }));
}
function gameCount(entry) {
  const given = Number(entry?.gamesPlayed);
  if (Number.isFinite(given) && given > 0) return given;
  const current = Number(entry?.current) || 0;
  if (!current) return 0;
  return 1;
}
function metric(entry) {
  const target = Number(entry?.target) || 0; if (!target) return null;
  const current = Number(entry?.current) || 0; const kind = entry?.kind || "player-prop";
  const raw = Math.max(0, Math.min(100, current / target * 100));
  const games = gameCount(entry); const season = seasonGames(entry); const required = target / season; const actual = games ? current / games : 0;
  const paceRatio = games ? actual / required : 0;
  const score = kind === "record" ? raw : games ? Math.max(0, Math.min(100, raw * .4 + Math.min(100, paceRatio * 100) * .6)) : 0;
  const payout = Number(entry?.payout) || 0; const stake = Number(entry?.stake) || 0;
  return { raw, games, season, required, actual, paceRatio, score, payout, stake, implied: payout * score / 100 };
}
function reportName(entry) { return entry.isParlayLeg ? `${entry.parentDesc}: ${entry.subject || "Leg"}` : (entry.desc || entry.subject || "Bet"); }
function reportFilterLabel() { const f = selectedFilters(); const parts = []; if (f.user !== "all") parts.push(f.user); if (f.sport !== "all") parts.push(sportLabel(f.sport)); if (f.kind !== "all") parts.push(kindLabel(f.kind)); return parts.length ? parts.join(" · ") : "All eligible bets"; }
function reportError(message) { const node = $("reportError"); if (!node) return; node.hidden = !message; node.textContent = message || ""; }

function renderReport() {
  const panel = $("reportPanel"); if (!panel) throw new Error("The report panel is missing from index.html.");
  panel.hidden = false; reportError("");
  const filtered = getFilteredBets();
  const entries = filtered.flatMap(reportEntries).map((entry) => ({ entry, metric: metric(entry) })).filter((item) => item.metric);
  $("reportTitle").textContent = reportFilterLabel();
  if (!entries.length) {
    $("reportStats").innerHTML = `<div class="stat-box"><span>Eligible entries</span><strong>0</strong></div>`;
    $("reportPercent").textContent = "—"; $("reportBar").style.width = "0%"; $("reportBar").style.background = solidColor(0);
    $("reportNote").textContent = "No player props, team-win totals, or parlay legs match the selected filters. Award and future tickets are excluded because they are binary outcomes.";
    $("reportChart").innerHTML = ""; return;
  }
  const payoutTotal = entries.reduce((sum, item) => sum + item.metric.payout, 0);
  const progress = payoutTotal ? entries.reduce((sum, item) => sum + item.metric.score * item.metric.payout, 0) / payoutTotal : entries.reduce((sum, item) => sum + item.metric.score, 0) / entries.length;
  const stake = entries.reduce((sum, item) => sum + item.metric.stake, 0);
  const value = entries.reduce((sum, item) => sum + item.metric.implied, 0);
  $("reportStats").innerHTML = `<div class="stat-box"><span>Eligible entries</span><strong>${entries.length}</strong></div><div class="stat-box"><span>Tickets selected</span><strong>${filtered.length}</strong></div><div class="stat-box"><span>Allocated stake</span><strong>${currency(stake)}</strong></div><div class="stat-box"><span>Implied payout value</span><strong>${currency(value)}</strong></div>`;
  $("reportPercent").textContent = `${progress.toFixed(0)}%`; $("reportBar").style.width = `${progress}%`; $("reportBar").style.background = solidColor(progress);
  $("reportNote").textContent = "Payout-weighted pace score. Player props combine current completion (40%) and pace versus required per-game average (60%). Team-win bets use current wins toward the target. Futures and awards are excluded.";
  $("reportChart").innerHTML = entries.sort((a, b) => b.metric.score - a.metric.score).map(({ entry, metric: m }) => {
    const detail = entry.kind === "record" ? `${num(entry.current)} wins / ${num(entry.target)} target` : m.games ? `${num(m.actual)}/game vs ${num(m.required)}/game required` : `${num(entry.current)} / ${num(entry.target)}`;
    return `<div class="chart-item"><div class="chart-row"><span class="chart-name" title="${escapeHtml(reportName(entry))}">${escapeHtml(reportName(entry))}</span><div class="chart-track"><div class="chart-fill" style="width:${m.score}%;background:${solidColor(m.score)}"></div></div><span class="chart-pct">${m.score.toFixed(0)}%</span></div><p class="chart-detail">${escapeHtml(detail)} · implied value ${currency(m.implied)} of ${currency(m.payout)}</p></div>`;
  }).join("");
}
function openReport() { try { renderReport(); $("reportPanel").scrollIntoView({ behavior: "smooth", block: "start" }); } catch (error) { const panel = $("reportPanel"); if (panel) { panel.hidden = false; reportError(`Chart Report could not finish: ${error.message}`); } else { $("statusLine").textContent = `Chart Report error: ${error.message}`; } console.error(error); } }

async function loadBets() {
  for (const url of [`https://raw.githubusercontent.com/ZacheryTaylor/bet-tracker/main/data/bets.json?t=${Date.now()}`, `data/bets.json?t=${Date.now()}`]) {
    try { const res = await fetch(url); if (!res.ok) continue; bets = normalizeBets(await res.json()); fillUsers(); render(); return; } catch (error) { console.warn(error); }
  }
  $("statusLine").textContent = "Could not load data/bets.json";
}
async function refreshRecord(bet) { if (!window.TeamRecord) throw new Error("Team record helper did not load"); const res = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings"); if (!res.ok) throw new Error(`Standings ${res.status}`); const record = window.TeamRecord.findOverallRecord(await res.json(), bet.subject); if (!record) throw new Error(`No overall record found for ${bet.subject}`); bet.current = record.wins; bet.losses = record.losses; bet.ties = record.ties; if ((bet.status || "open") === "open" && pct(bet) >= 100) bet.status = "hit"; return true; }
async function refreshOne(bet) { if (!bet || isBinary(bet)) return false; if (bet.kind === "record") return refreshRecord(bet); if (bet.kind === "parlay") { let updated = false; for (const leg of bet.legs || []) { leg.sport = leg.sport || bet.sport || "nfl"; if (await window.EspnPlayer.refreshPlayer(leg)) updated = true; } if (updated && (bet.legs || []).every((leg) => pct(leg) >= 100)) bet.status = "hit"; return updated; } return window.EspnPlayer.refreshPlayer(bet); }

$("refreshBtn").addEventListener("click", async () => { if (!window.EspnPlayer || !window.TeamRecord) { $("statusLine").textContent = "Refresh helpers failed to load."; return; } $("refreshBtn").disabled = true; $("statusLine").textContent = "Refreshing ESPN…"; let updated = 0; const missed = []; for (const bet of bets) { try { if (await refreshOne(bet)) updated += 1; else if (!isBinary(bet)) missed.push(bet.desc || bet.subject || bet.id); } catch (_) { missed.push(bet.desc || bet.subject || bet.id); } } render(); if (!$("reportPanel").hidden) openReport(); $("refreshBtn").disabled = false; $("statusLine").textContent = `Updated ${updated} bet(s).` + (missed.length ? ` Still empty: ${missed.slice(0, 8).join("; ")}` : ""); });
$("reportBtn").addEventListener("click", openReport);
$("closeReportBtn").addEventListener("click", () => { $("reportPanel").hidden = true; });
["filterUser", "filterSport", "filterType", "filterTimeline", "filterStatus"].forEach((id) => $(id).addEventListener("change", () => { render(); if (!$("reportPanel").hidden) openReport(); }));
fillSports();
loadBets();
