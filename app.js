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
    const money = b.notes || "";
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
        <p class="meta">${lp.toFixed(0)}% · ${Number(leg.current) || 0} / ${Number(leg.target)}</p>
      </div>`;
    }).join("")}</div>` : "";
    return `<article class="card">
      <div class="card-top">
        <div>
          <p class="title">${escapeHtml(b.desc)}</p>
          <p class="meta">${escapeHtml(b.subject || "")}${money ? " · " + escapeHtml(money) : ""}</p>
        </div>
        <div class="chips">
          <span class="chip">${sportLabel(b.sport)}</span>
          <span class="chip">${kindLabel(k)}</span>
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

function walkTeams(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) { node.forEach((n) => walkTeams(n, acc)); return acc; }
  if (node.team && (node.stats || node.team.record)) acc.push(node);
  ["children", "standings", "entries"].forEach((k) => { if (node[k]) walkTeams(node[k], acc); });
  return acc;
}

async function refreshRecord(bet) {
  const res = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings");
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
  if (!bet) return false;
  if (bet.kind === "record") return refreshRecord(bet);
  if (bet.kind === "award") return false;
  if (bet.kind === "parlay") {
    let any = false;
    for (const leg of bet.legs || []) {
      leg.sport = leg.sport || bet.sport || "nfl";
      if (window.EspnPlayer && await window.EspnPlayer.refreshPlayer(leg)) any = true;
    }
    if (any) {
      const legs = bet.legs || [];
      if (legs.length && legs.every((l) => pct(l) >= 100)) bet.status = "hit";
    }
    return any;
  }
  return !!(window.EspnPlayer && await window.EspnPlayer.refreshPlayer(bet));
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
      missed.push((bet.desc || bet.id) + "");
    }
  }
  render();
  $("refreshBtn").disabled = false;
  $("statusLine").textContent = `Updated ${n} bet(s).` + (missed.length ? ` Missed: ${missed.slice(0, 8).join("; ")}` : "");
});

["filterSport", "filterType", "filterTimeline", "filterStatus"].forEach((id) => {
  $(id).addEventListener("change", render);
});
fillSports();
loadBets();
