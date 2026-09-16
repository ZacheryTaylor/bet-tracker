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
const CONFIG_PATH = "config.js";
const TOKEN_KEY = "bet-tracker-gh-token";
const UNLOCK_KEY = "bet-tracker-unlocked";
const LOCAL_KEY = "bet-tracker-bets";
const OWNER = "ZacheryTaylor";
const REPO = "bet-tracker";
const $ = (id) => document.getElementById(id);

let bets = [];
let fileSha = null;
let configSha = null;
let unlocked = sessionStorage.getItem(UNLOCK_KEY) === "1";

function token() {
  return (window.BET_TRACKER_TOKEN || "").trim()
    || localStorage.getItem(TOKEN_KEY)
    || ($("ghToken") && $("ghToken").value.trim())
    || "";
}

function contentsUrl(path) {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
}

function authHeaders(tok) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (tok) headers.Authorization = `Bearer ${tok}`;
  return headers;
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

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(bets));
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
  if (!$("statusLine").textContent.startsWith("Saved") && !$("statusLine").textContent.startsWith("GitHub")) {
    $("statusLine").textContent = `${filtered.length} of ${bets.length} bets`;
  }
  $("betList").innerHTML = filtered.map((b) => {
    const p = pct(b);
    const k = b.kind || "player-prop";
    const record = k === "record" ? `${Number(b.current) || 0}-${Number(b.losses) || 0}` : `${Number(b.current)} / ${Number(b.target)}`;
    const update = unlocked && k !== "game" ? `<div class="update-row">
        <input class="current-input" type="number" step="any" value="${Number(b.current)}" />
        <button type="button" class="ghost" data-act="set-current">Update current</button>
        ${k === "record" ? `<input class="losses-input" type="number" step="1" value="${Number(b.losses) || 0}" />
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

async function getFile(path) {
  const res = await fetch(contentsUrl(path) + `?ref=main&t=${Date.now()}`, { headers: authHeaders(token()) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  const json = await res.json();
  return { sha: json.sha, text: fromBase64(json.content) };
}

async function putFile(path, text, sha, message) {
  const res = await fetch(contentsUrl(path), {
    method: "PUT",
    headers: { ...authHeaders(token()), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: toBase64(text),
      sha,
      branch: "main"
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err.slice(0, 180)}`);
  }
  const json = await res.json();
  return json.content.sha;
}

async function loadBets() {
  bets = readLocal();
  render();
  try {
    const file = await getFile(DATA_PATH);
    fileSha = file.sha;
    const remote = JSON.parse(file.text);
    if (Array.isArray(remote) && remote.length) {
      bets = remote;
      writeLocal();
    } else if (bets.length && token()) {
      await persist();
      return;
    }
    render();
    $("statusLine").textContent = `${bets.length} bet(s) from GitHub`;
  } catch (e) {
    console.warn(e);
    render();
    $("statusLine").textContent = bets.length
      ? `${bets.length} bet(s) on this device. GitHub not connected yet.`
      : "No bets yet.";
  }
}

async function persist() {
  writeLocal();
  render();
  const tok = token();
  if (!tok) {
    $("statusLine").textContent = "Not on GitHub yet. Unlock and paste a Contents token so other computers can see this.";
    return false;
  }
  try {
    if (!fileSha) {
      const file = await getFile(DATA_PATH);
      fileSha = file.sha;
    }
    fileSha = await putFile(DATA_PATH, JSON.stringify(bets, null, 2) + "\n", fileSha, "Update bets");
    $("statusLine").textContent = `Saved to GitHub (${bets.length} bet(s)). Any computer can refresh and see this.`;
    return true;
  } catch (e) {
    try {
      const file = await getFile(DATA_PATH);
      fileSha = file.sha;
      fileSha = await putFile(DATA_PATH, JSON.stringify(bets, null, 2) + "\n", fileSha, "Update bets");
      $("statusLine").textContent = `Saved to GitHub (${bets.length} bet(s)).`;
      return true;
    } catch (e2) {
      $("statusLine").textContent = "GitHub save failed: " + e2.message;
      return false;
    }
  }
}

async function publishToken(tok) {
  window.BET_TRACKER_TOKEN = tok;
  localStorage.setItem(TOKEN_KEY, tok);
  const body = `window.BET_TRACKER_TOKEN = ${JSON.stringify(tok)};\n`;
  try {
    const file = await getFile(CONFIG_PATH);
    configSha = file.sha;
    await putFile(CONFIG_PATH, body, configSha, "Store tracker token for all computers");
  } catch (e) {
    console.warn("Could not write config.js", e);
  }
}

$("betForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!unlocked) return;
  if (!token()) {
    $("statusLine").textContent = "Connect a GitHub token first so the bet is saved for every computer.";
    $("lockPanel").hidden = false;
    return;
  }
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
    bet.current = Number(card.querySelector(".current-input").value);
    if (pct(bet) >= 100 && bet.status === "open") bet.status = "hit";
  } else if (act === "set-losses") {
    bet.losses = Number(card.querySelector(".losses-input").value);
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

$("unlockBtn").addEventListener("click", async () => {
  if ($("passcode").value !== PASSCODE) {
    $("lockStatus").textContent = "Wrong passcode.";
    return;
  }
  const tok = $("ghToken").value.trim() || token();
  if (!tok) {
    $("lockStatus").textContent = "Paste the GitHub token so saves work on every computer.";
    return;
  }
  $("lockStatus").textContent = "Connecting to GitHub…";
  await publishToken(tok);
  try {
    const file = await getFile(DATA_PATH);
    fileSha = file.sha;
    setUnlocked(true);
    $("lockStatus").textContent = "Connected. Adding a bet now writes GitHub automatically.";
    await loadBets();
  } catch (e) {
    $("lockStatus").textContent = "Token did not work: " + e.message;
  }
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
  $("statusLine").textContent = `ESPN done. Updated ${updated} record/game bet(s)${errors ? `, ${errors} error(s)` : ""}. Player props stay manual.`;
});

fillSports();
$("date").value = new Date().toISOString().slice(0, 10);
toggleKindFields();
if (token()) $("ghToken").placeholder = "Token already available";
setUnlocked(unlocked);
loadBets();
