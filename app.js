const SPORTS = [
  { id: "nfl", label: "NFL", path: "football/nfl" },
  { id: "ncaaf", label: "College football", path: "football/college-football" },
  { id: "nba", label: "NBA", path: "basketball/nba" },
  { id: "ncaab", label: "College basketball", path: "basketball/mens-college-basketball" },
  { id: "mlb", label: "MLB", path: "baseball/mlb" },
  { id: "nhl", label: "NHL", path: "hockey/nhl" },
  { id: "soccer", label: "Soccer (MLS)", path: "soccer/usa.1" },
  { id: "other", label: "Other", path: null }
];

const DATA_PATH = "data/bets.json";
const TOKEN_KEY = "bet-tracker-gh-token";
const $ = (id) => document.getElementById(id);

let bets = [];
let fileSha = null;

function cfg() {
  return {
    owner: $("ghOwner").value.trim() || "ZacheryTaylor",
    repo: $("ghRepo").value.trim() || "bet-tracker",
    token: localStorage.getItem(TOKEN_KEY) || $("ghToken").value.trim()
  };
}

function apiBase() {
  const { owner, repo } = cfg();
  return `https://api.github.com/repos/${owner}/${repo}/contents/${DATA_PATH}`;
}

function sportLabel(id) {
  return (SPORTS.find((s) => s.id === id) || {}).label || id;
}

function pct(bet) {
  const t = Number(bet.target) || 1;
  const c = Number(bet.current) || 0;
  return Math.max(0, Math.min(100, (c / t) * 100));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fillSports() {
  const opts = SPORTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  $("sport").innerHTML = opts;
  $("filterSport").innerHTML = `<option value="all">All sports</option>` + opts;
}

function render() {
  const sport = $("filterSport").value;
  const timeline = $("filterTimeline").value;
  const status = $("filterStatus").value;
  const filtered = bets.filter((b) => {
    if (sport !== "all" && b.sport !== sport) return false;
    if (timeline !== "all" && b.timeline !== timeline) return false;
    if (status !== "all" && b.status !== status) return false;
    return true;
  });
  $("statusLine").textContent = `${filtered.length} of ${bets.length} bets`;
  $("betList").innerHTML = filtered.map((b) => {
    const p = pct(b);
    return `<article class="card" data-id="${b.id}">
      <div class="card-top">
        <div>
          <p class="title">${escapeHtml(b.desc)}</p>
          <p class="meta">${escapeHtml(b.notes || "")}${b.date ? " · " + b.date : ""}${b.lastSync ? " · synced " + b.lastSync : ""}</p>
        </div>
        <div class="chips">
          <span class="chip">${sportLabel(b.sport)}</span>
          <span class="chip">${b.timeline === "season" ? "Season long" : "Single game"}</span>
          <span class="chip">${b.status}</span>
        </div>
      </div>
      <div class="bar"><span style="width:${p}%"></span></div>
      <p class="meta">${p.toFixed(0)}% · ${Number(b.current)} / ${Number(b.target)}</p>
      <div class="actions">
        <button type="button" class="ghost" data-act="bump">+1 current</button>
        <button type="button" class="ghost" data-act="hit">Hit</button>
        <button type="button" class="ghost" data-act="miss">Miss</button>
        <button type="button" class="ghost" data-act="open">Reopen</button>
        <button type="button" class="ghost" data-act="delete">Delete</button>
      </div>
    </article>`;
  }).join("") || `<p class="meta">No bets match these filters.</p>`;
}

async function loadBets() {
  $("statusLine").textContent = "Loading shared bets…";
  const headers = { Accept: "application/vnd.github+json" };
  const { token } = cfg();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(apiBase() + `?t=${Date.now()}`, { headers });
    if (res.ok) {
      const json = await res.json();
      fileSha = json.sha;
      bets = JSON.parse(atob(json.content.replace(/\n/g, "")));
      render();
      return;
    }
  } catch (e) {
    console.warn(e);
  }
  const res = await fetch(DATA_PATH + `?t=${Date.now()}`);
  bets = res.ok ? await res.json() : [];
  render();
}

async function persist() {
  const { token } = cfg();
  if (!token) {
    $("statusLine").textContent = "Bets updated on this screen only. Add a GitHub token in Settings to save for every computer.";
    render();
    return;
  }
  const body = {
    message: "Update bets",
    content: btoa(unescape(encodeURIComponent(JSON.stringify(bets, null, 2) + "\n"))),
    sha: fileSha || undefined
  };
  const res = await fetch(apiBase(), {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    $("statusLine").textContent = "Save failed: " + res.status + " " + err.slice(0, 180);
    return;
  }
  const json = await res.json();
  fileSha = json.content.sha;
  $("statusLine").textContent = "Saved to GitHub. Other computers will see this after refresh.";
  render();
}

$("betForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  bets.unshift({
    id: crypto.randomUUID(),
    desc: $("desc").value.trim(),
    notes: $("notes").value.trim(),
    sport: $("sport").value,
    timeline: $("timeline").value,
    metric: $("metric").value,
    date: $("date").value,
    target: Number($("target").value),
    current: Number($("current").value),
    line: $("line").value === "" ? null : Number($("line").value),
    teamQuery: $("teamQuery").value.trim(),
    status: "open",
    createdAt: new Date().toISOString(),
    lastSync: null,
    espnEventId: null
  });
  $("betForm").reset();
  $("target").value = 1;
  $("current").value = 0;
  $("date").value = new Date().toISOString().slice(0, 10);
  await persist();
});

$("betList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".card").dataset.id;
  const bet = bets.find((b) => b.id === id);
  const act = btn.dataset.act;
  if (act === "delete") bets = bets.filter((b) => b.id !== id);
  else {
    if (act === "bump") bet.current = Number(bet.current) + 1;
    if (act === "hit") { bet.status = "hit"; bet.current = bet.target; }
    if (act === "miss") bet.status = "miss";
    if (act === "open") bet.status = "open";
    if (pct(bet) >= 100 && bet.status === "open" && act === "bump") bet.status = "hit";
  }
  await persist();
});

["filterSport", "filterTimeline", "filterStatus"].forEach((id) => {
  $(id).addEventListener("change", render);
});

$("settingsBtn").addEventListener("click", () => {
  $("settingsPanel").hidden = !$("settingsPanel").hidden;
});

$("saveTokenBtn").addEventListener("click", () => {
  const token = $("ghToken").value.trim();
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  $("settingsStatus").textContent = token ? "Token saved in this browser." : "Token cleared.";
  loadBets();
});

function scoreboardUrl(sportId, dateStr) {
  const sport = SPORTS.find((s) => s.id === sportId);
  if (!sport || !sport.path) return null;
  const dates = (dateStr || "").replaceAll("-", "");
  const q = dates ? `?dates=${dates}` : "";
  return `https://site.api.espn.com/apis/site/v2/sports/${sport.path}/scoreboard${q}`;
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

function applyEspn(bet, event) {
  const comp = event.competitions?.[0];
  if (!comp) return;
  const me = findCompetitor(event, bet.teamQuery);
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
    bet.current = cover ? 1 : finished ? 0 : 0;
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
  $("refreshBtn").disabled = true;
  $("statusLine").textContent = "Pulling ESPN scoreboards…";
  const groups = {};
  for (const b of bets) {
    if (b.metric === "manual" || b.sport === "other") continue;
    const key = `${b.sport}|${b.date || "today"}`;
    (groups[key] ||= []).push(b);
  }
  let updated = 0;
  let errors = 0;
  for (const [key, group] of Object.entries(groups)) {
    const [sport, date] = key.split("|");
    const url = scoreboardUrl(sport, date === "today" ? "" : date);
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const events = data.events || [];
      for (const bet of group) {
        const event = events.find((ev) => findCompetitor(ev, bet.teamQuery)) || events.find((ev) => ev.id === bet.espnEventId);
        if (!event) continue;
        applyEspn(bet, event);
        updated += 1;
      }
    } catch (err) {
      errors += 1;
      console.warn(err);
    }
  }
  $("refreshBtn").disabled = false;
  await persist();
  $("statusLine").textContent = `ESPN refresh done. Updated ${updated} bet(s)${errors ? `, ${errors} request error(s)` : ""}.`;
});

fillSports();
$("date").value = new Date().toISOString().slice(0, 10);
if (localStorage.getItem(TOKEN_KEY)) $("ghToken").placeholder = "Token saved in this browser";
loadBets();
