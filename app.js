const PASSCODE = "tracker";
const SPORTS = [
  { id: "nfl", label: "NFL", path: "football/nfl", standings: "football/nfl" },
  { id: "ncaaf", label: "College football", path: "football/college-football", standings: "football/college-football" },
  { id: "nba", label: "NBA", path: "basketball/nba", standings: "basketball/nba" },
  { id: "ncaab", label: "College basketball", path: "basketball/mens-college-basketball", standings: "basketball/mens-college-basketball" },
  { id: "mlb", label: "MLB", path: "baseball/mlb", standings: "baseball/mlb" },
  { id: "nhl", label: "NHL", path: "hockey/nhl", standings: "hockey/nhl" },
  { id: "soccer", label: "Soccer (MLS)", path: "soccer/usa.1", standings: null },
  { id: "other", label: "Other", path: null, standings: null }
];

const DATA_PATH = "data/bets.json";
const TOKEN_KEY = "bet-tracker-gh-token";
const UNLOCK_KEY = "bet-tracker-unlocked";
const OWNER = "ZacheryTaylor";
const REPO = "bet-tracker";
const $ = (id) => document.getElementById(id);

let bets = [];
let fileSha = null;
let unlocked = sessionStorage.getItem(UNLOCK_KEY) === "1";

function token() {
  return localStorage.getItem(TOKEN_KEY) || $("ghToken").value.trim();
}

function apiUrl() {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`;
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

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function fillSports() {
  const opts = SPORTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  $("sport").innerHTML = opts;
  $("filterSport").innerHTML = `<option value="all">All sports</option>` + opts;
}

function setUnlocked(on) {
  unlocked = on;
  sessionStorage.setItem(UNLOCK_KEY, on ? "1" : "0");
  document.querySelectorAll(".edit-only").forEach((el) => { el.hidden = !on; });
  $("lockBtn").textContent = on ? "Editing on" : "Unlock";
  $("lockPanel").hidden = on;
  render();
}

function toggleKindFields() {
  const kind = $("kind").value;
  document.querySelectorAll(".game-only").forEach((el) => { el.hidden = kind !== "game"; });
  document.querySelectorAll(".record-only").forEach((el) => { el.hidden = kind !== "record"; });
  if (kind === "player-prop" || kind === "record") $("timeline").value = $("timeline").value || "season";
}

function render() {
  const sport = $("filterSport").value;
  const kind = $("filterType").value;
  const timeline = $("filterTimeline").value;
  const status = $("filterStatus").value;
  const filtered = bets.filter((b) => {
    const k = b.kind || (b.metric === "manual" ? "player-prop" : "game");
    if (sport !== "all" && b.sport !== sport) return false;
    if (kind !== "all" && k !== kind) return false;
    if (timeline !== "all" && b.timeline !== timeline) return false;
    if (status !== "all" && b.status !== status) return false;
    return true;
  });
  $("statusLine").textContent = `${filtered.length} of ${bets.length} bets`;
  $("betList").innerHTML = filtered.map((b) => {
    const p = pct(b);
    const k = b.kind || "player-prop";
    const record = k === "record" ? `${Number(b.current) || 0}-${Number(b.losses) || 0}` : `${Number(b.current)} / ${Number(b.target)}`;
    const update = unlocked && k !== "game" ? `<div class="update-row">
        <input data-id="${b.id}" class="current-input" type="number" step="any" value="${Number(b.current)}" />
        <button type="button" class="ghost" data-act="set-current">Update current</button>
        ${k === "record" ? `<input data-id="${b.id}" class="losses-input" type="number" step="1" value="${Number(b.losses) || 0}" />
        <button type="button" class="ghost" data-act="set-losses">Update losses</button>` : ""}
      </div>` : "";
    const admin = unlocked ? `<div class="actions">
        <button type="button" class="ghost" data-act="hit">Hit</button>
        <button type="button" class="ghost" data-act="miss">Miss</button>
        <button type="button" class="ghost" data-act="open">Reopen</button>
        <button type="button" class="ghost" data-act="delete">Delete</button>
      </div>` : "";
    return `<article class="card" data-id="${b.id}">
      <div class="card-top">
        <div>
          <p class="title">${escapeHtml(b.desc)}</p>
          <p class="meta">${escapeHtml(b.subject || "")}${b.notes ? " · " + escapeHtml(b.notes) : ""}${b.date ? " · " + b.date : ""}${b.lastSync ? " · synced " + b.lastSync : ""}</p>
        </div>
        <div class="chips">
          <span class="chip">${sportLabel(b.sport)}</span>
          <span class="chip">${kindLabel(k)}</span>
          <span class="chip">${b.timeline === "single" ? "Single game" : "Season long"}</span>
          <span class="chip">${b.status}</span>
        </div>
      </div>
      <div class="bar"><span style="width:${p}%;background:${solidColor(p)}"></span></div>
      <p class="meta">${p.toFixed(0)}% · ${record}${k === "record" ? " · target " + Number(b.target) + " wins" : ""}</p>
      ${update}${admin}
    </article>`;
  }).join("") || `<p class="meta">No bets yet.</p>`;
}

async function refreshShaAndLoad() {
  const headers = { Accept: "application/vnd.github+json" };
  const tok = token();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const res = await fetch(apiUrl() + `?ref=main&t=${Date.now()}`, { headers });
  if (!res.ok) throw new Error(`GitHub read ${res.status}`);
  const json = await res.json();
  fileSha = json.sha;
  bets = JSON.parse(fromBase64(json.content));
  if (!Array.isArray(bets)) bets = [];
}

async function loadBets() {
  $("statusLine").textContent = "Loading shared bets…";
  try {
    await refreshShaAndLoad();
    render();
  } catch (e) {
    console.warn(e);
    try {
      const res = await fetch(`${DATA_PATH}?t=${Date.now()}`);
      bets = res.ok ? await res.json() : [];
    } catch {
      bets = [];
    }
    render();
    $("statusLine").textContent = "Loaded static copy. GitHub API read failed — saves will fail until a token works.";
  }
}

async function persist() {
  const tok = token();
  if (!tok) {
    render();
    $("statusLine").textContent = "Not saved to GitHub. Unlock and save a Contents write token first.";
    return false;
  }
  try {
    if (!fileSha) await refreshShaAndLoad();
  } catch (e) {
    $("statusLine").textContent = "Could not read file SHA: " + e.message;
    return false;
  }
  const payload = {
    message: "Update bets",
    content: toBase64(JSON.stringify(bets, null, 2) + "\n"),
    sha: fileSha,
    branch: "main"
  };
  const res = await fetch(apiUrl(), {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tok}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify(payload)
  });
  if (res.status === 409 || res.status === 422) {
    await refreshShaAndLoad();
    payload.sha = fileSha;
    payload.content = toBase64(JSON.stringify(bets, null, 2) + "\n");
    const retry = await fetch(apiUrl(), {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!retry.ok) {
      $("statusLine").textContent = "Save failed after retry: " + retry.status;
      return false;
    }
    const json = await retry.json();
    fileSha = json.content.sha;
    $("statusLine").textContent = "Saved to GitHub.";
    render();
    return true;
  }
  if (!res.ok) {
    const err = await res.text();
    $("statusLine").textContent = "Save failed: " + res.status + " — check token Contents write on bet-tracker. " + err.slice(0, 160);
    return false;
  }
  const json = await res.json();
  fileSha = json.content.sha;
  $("statusLine").textContent = "Saved to GitHub. Anyone can see this after a refresh.";
  render();
  return true;
}

$("betForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!unlocked) return;
  const kind = $("kind").value;
  bets.unshift({
    id: crypto.randomUUID(),
    kind,
    desc: $("desc").value.trim(),
    subject: $("subject").value.trim(),
    notes: $("notes").value.trim(),
    sport: $("sport").value,
    timeline: $("timeline").value,
    metric: kind === "game" ? $("metric").value : kind,
    date: $("date").value,
    target: Number($("target").value),
    current: Number($("current").value),
    losses: Number($("losses").value) || 0,
    line: $("line").value === "" ? null : Number($("line").value),
    teamQuery: $("subject").value.trim(),
    status: "open",
    createdAt: new Date().toISOString(),
    lastSync: null,
    espnEventId: null
  });
  $("betForm").reset();
  $("target").value = 1;
  $("current").value = 0;
  $("losses").value = 0;
  $("date").value = new Date().toISOString().slice(0, 10);
  $("kind").value = "player-prop";
  toggleKindFields();
  await persist();
});

$("betList").addEventListener("click", async (e) => {
  if (!unlocked) return;
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const card = btn.closest(".card");
  const id = card.dataset.id;
  const bet = bets.find((b) => b.id === id);
  const act = btn.dataset.act;
  if (act === "delete") bets = bets.filter((b) => b.id !== id);
  else if (act === "set-current") {
    const input = card.querySelector(".current-input");
    bet.current = Number(input.value);
    if (pct(bet) >= 100 && bet.status === "open") bet.status = "hit";
  } else if (act === "set-losses") {
    const input = card.querySelector(".losses-input");
    bet.losses = Number(input.value);
  } else {
    if (act === "hit") { bet.status = "hit"; bet.current = bet.target; }
    if (act === "miss") bet.status = "miss";
    if (act === "open") bet.status = "open";
  }
  await persist();
});

["filterSport", "filterType", "filterTimeline", "filterStatus"].forEach((id) => {
  $(id).addEventListener("change", render);
});
$("kind").addEventListener("change", toggleKindFields);

$("unlockBtn").addEventListener("click", () => {
  if ($("passcode").value === PASSCODE) {
    const tok = $("ghToken").value.trim();
    if (tok) localStorage.setItem(TOKEN_KEY, tok);
    setUnlocked(true);
    $("lockStatus").textContent = token() ? "Unlocked. Saves will write data/bets.json." : "Unlocked, but saves will not reach GitHub until you save a token.";
    loadBets();
  } else {
    $("lockStatus").textContent = "Wrong passcode.";
  }
});

$("saveTokenBtn").addEventListener("click", () => {
  const tok = $("ghToken").value.trim();
  if (tok) localStorage.setItem(TOKEN_KEY, tok);
  else localStorage.removeItem(TOKEN_KEY);
  $("lockStatus").textContent = tok ? "Token saved in this browser." : "Token cleared.";
});

$("lockNowBtn").addEventListener("click", () => setUnlocked(false));
$("lockBtn").addEventListener("click", () => {
  $("lockPanel").hidden = false;
});

function scoreboardUrl(sportId, dateStr) {
  const sport = SPORTS.find((s) => s.id === sportId);
  if (!sport || !sport.path) return null;
  const dates = (dateStr || "").replaceAll("-", "");
  const q = dates ? `?dates=${dates}` : "";
  return `https://site.api.espn.com/apis/site/v2/sports/${sport.path}/scoreboard${q}`;
}

function standingsUrl(sportId) {
  const sport = SPORTS.find((s) => s.id === sportId);
  if (!sport || !sport.standings) return null;
  return `https://site.api.espn.com/apis/v2/sports/${sport.standings}/standings`;
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function walkTeams(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => walkTeams(n, acc));
    return acc;
  }
  if (node.team && (node.stats || node.team.record)) acc.push(node);
  if (node.children) walkTeams(node.children, acc);
  if (node.standings) walkTeams(node.standings, acc);
  if (node.entries) walkTeams(node.entries, acc);
  return acc;
}

function recordFromEntry(entry) {
  const stats = entry.stats || [];
  const wins = Number((stats.find((s) => s.name === "wins") || {}).value);
  const losses = Number((stats.find((s) => s.name === "losses") || {}).value);
  if (!Number.isNaN(wins) || !Number.isNaN(losses)) return { wins: wins || 0, losses: losses || 0 };
  const summary = entry.team?.record?.items?.[0]?.summary || "";
  const m = summary.match(/^(\d+)-(\d+)/);
  if (m) return { wins: Number(m[1]), losses: Number(m[2]) };
  return null;
}

function applyEspnGame(bet, event) {
  const comp = event.competitions?.[0];
  if (!comp) return;
  const me = findCompetitor(event, bet.subject || bet.teamQuery);
  const scores = (comp.competitors || []).map((c) => Number(c.score) || 0);
  const total = scores.reduce((a, b) => a + b, 0);
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
    const cover = myScore + Number(bet.line) > oppScore;
    bet.current = cover ? 1 : 0;
    if (finished) bet.status = cover ? "hit" : "miss";
  } else if (bet.metric === "total-over" && bet.line != null) {
    bet.target = Number(bet.line);
    bet.current = total;
    if (finished) bet.status = total > Number(bet.line) ? "hit" : "miss";
  } else if (bet.metric === "total-under" && bet.line != null) {
    bet.target = 1;
    const under = total < Number(bet.line);
    bet.current = finished ? (under ? 1 : 0) : Math.max(0, 1 - total / Number(bet.line));
    if (finished) bet.status = under ? "hit" : "miss";
  }
  bet.espnEventId = event.id;
  bet.lastSync = new Date().toLocaleString();
}

$("refreshBtn").addEventListener("click", async () => {
  if (!unlocked) return;
  $("refreshBtn").disabled = true;
  $("statusLine").textContent = "Pulling ESPN…";
  let updated = 0;
  let errors = 0;
  const recordGroups = {};
  const gameGroups = {};
  for (const b of bets) {
    const kind = b.kind || "player-prop";
    if (kind === "player-prop") continue;
    if (kind === "record") (recordGroups[b.sport] ||= []).push(b);
    if (kind === "game") {
      const key = `${b.sport}|${b.date || "today"}`;
      (gameGroups[key] ||= []).push(b);
    }
  }
  for (const [sport, group] of Object.entries(recordGroups)) {
    const url = standingsUrl(sport);
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const entries = walkTeams(data);
      for (const bet of group) {
        const q = norm(bet.subject || bet.teamQuery);
        const entry = entries.find((en) => {
          const names = [en.team?.displayName, en.team?.shortDisplayName, en.team?.abbreviation, en.team?.name, en.team?.nickname, en.team?.location];
          return names.some((n) => q && (norm(n).includes(q) || q.includes(norm(n))));
        });
        if (!entry) continue;
        const rec = recordFromEntry(entry);
        if (!rec) continue;
        bet.current = rec.wins;
        bet.losses = rec.losses;
        if (bet.status === "open" && pct(bet) >= 100) bet.status = "hit";
        bet.lastSync = new Date().toLocaleString();
        updated += 1;
      }
    } catch (err) {
      errors += 1;
      console.warn(err);
    }
  }
  for (const [key, group] of Object.entries(gameGroups)) {
    const [sport, date] = key.split("|");
    const url = scoreboardUrl(sport, date === "today" ? "" : date);
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const events = data.events || [];
      for (const bet of group) {
        const event = events.find((ev) => findCompetitor(ev, bet.subject || bet.teamQuery)) || events.find((ev) => ev.id === bet.espnEventId);
        if (!event) continue;
        applyEspnGame(bet, event);
        updated += 1;
      }
    } catch (err) {
      errors += 1;
      console.warn(err);
    }
  }
  $("refreshBtn").disabled = false;
  await persist();
  $("statusLine").textContent = `ESPN done. Updated ${updated} record/game bet(s)${errors ? `, ${errors} error(s)` : ""}. Player props stay manual.` ;
});

fillSports();
$("date").value = new Date().toISOString().slice(0, 10);
toggleKindFields();
if (localStorage.getItem(TOKEN_KEY)) $("ghToken").placeholder = "Token already saved in this browser";
setUnlocked(unlocked);
loadBets();
