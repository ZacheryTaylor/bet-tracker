function compact(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function walk(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, fn)); return; }
  fn(node);
  Object.values(node).forEach((v) => { if (v && typeof v === "object") walk(v, fn); });
}

const STAT_META = {
  passingYards: { cat: "passing", names: ["passingyards", "passingyds", "netpassingyards"], label: "YDS", nth: 0 },
  passingTouchdowns: { cat: "passing", names: ["passingtouchdowns", "passingtds"], label: "TD", nth: 0 },
  rushingYards: { cat: "rushing", names: ["rushingyards", "rushingyds"], label: "YDS", nth: 1 },
  rushingTouchdowns: { cat: "rushing", names: ["rushingtouchdowns", "rushingtds"], label: "TD", nth: 1 },
  receivingYards: { cat: "receiving", names: ["receivingyards", "receivingyds"], label: "YDS", nth: 0 },
  receptions: { cat: "receiving", names: ["receptions"], label: "REC", nth: 0 },
  receivingTouchdowns: { cat: "receiving", names: ["receivingtouchdowns", "receivingtds"], label: "TD", nth: 0 }
};

function namedValue(data, stat) {
  const meta = STAT_META[stat];
  const names = meta ? meta.names.concat([compact(stat)]) : [compact(stat)];
  const cat = meta ? meta.cat : "";
  const hits = [];
  walk(data, (obj) => {
    if (!Array.isArray(obj.stats)) return;
    const catName = compact(obj.name || obj.displayName || obj.abbreviation);
    const catOk = !cat || catName.includes(cat) || !catName;
    obj.stats.forEach((st) => {
      const n = compact(st.name || st.abbreviation || st.displayName);
      if (!names.includes(n)) return;
      if (!catOk && n === "yds" || n === "td") return;
      if (cat && (n === "yds" || n === "td") && !catName.includes(cat)) return;
      const v = Number(st.value != null ? st.value : st.displayValue);
      if (!Number.isNaN(v)) hits.push(v);
    });
  });
  if (hits.length) return hits[hits.length - 1];
  walk(data, (obj) => {
    const n = compact(obj.name || obj.displayName);
    if (!names.includes(n)) return;
    const v = Number(obj.value != null ? obj.value : obj.displayValue);
    if (!Number.isNaN(v)) hits.push(v);
  });
  return hits.length ? hits[hits.length - 1] : null;
}

function sumGamelog(data, stat) {
  const meta = STAT_META[stat];
  if (!meta) return null;
  let total = 0;
  let used = false;
  walk(data, (obj) => {
    const labels = obj.labels || obj.displayNames;
    const events = obj.events;
    if (!Array.isArray(labels) || !Array.isArray(events)) return;
    const L = labels.map((x) => String(x).toUpperCase());
    let idx = -1;
    if (stat === "receptions") idx = L.indexOf("REC");
    else if (stat === "passingYards") idx = L.indexOf("YDS");
    else if (stat === "rushingYards") {
      const car = Math.max(L.indexOf("CAR"), L.indexOf("RUSH"), L.indexOf("ATT"));
      idx = L.indexOf("YDS", meta.nth === 1 ? 1 : 0);
      if (car >= 0) {
        const after = L.indexOf("YDS", car);
        if (after >= 0) idx = after;
      }
    } else if (stat === "receivingYards") {
      const rec = L.indexOf("REC");
      idx = rec >= 0 ? L.indexOf("YDS", rec) : L.indexOf("YDS");
    } else if (stat === "passingTouchdowns") idx = L.indexOf("TD");
    else if (stat === "rushingTouchdowns") {
      const firstTd = L.indexOf("TD");
      idx = L.indexOf("TD", firstTd + 1);
      if (idx < 0) idx = firstTd;
    } else if (stat === "receivingTouchdowns") {
      const rec = L.indexOf("REC");
      idx = rec >= 0 ? L.indexOf("TD", rec) : L.lastIndexOf("TD");
    }
    if (idx < 0) return;
    events.forEach((ev) => {
      const stats = ev.stats || ev.athleteStats;
      if (!Array.isArray(stats) || stats[idx] == null) return;
      const v = Number(String(stats[idx]).replace(/[^0-9.+-]/g, ""));
      if (!Number.isNaN(v)) { total += v; used = true; }
    });
  });
  return used ? total : null;
}

function idFromBlob(blob, sport) {
  const text = typeof blob === "string" ? blob : JSON.stringify(blob);
  const nfl = [...text.matchAll(/espn\.com\/nfl\/player(?:\/stats)?\/_\/id\/(\d+)/g)].map((m) => m[1]);
  if ((sport || "nfl") === "nfl" && nfl.length) return nfl[0];
  const cfb = [...text.matchAll(/espn\.com\/college-football\/player(?:\/stats)?\/_\/id\/(\d+)/g)].map((m) => m[1]);
  if (cfb.length) return cfb[0];
  return nfl[0] || null;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function resolveAthleteId(bet) {
  if (bet.espnAthleteId) return String(bet.espnAthleteId);
  const q = encodeURIComponent(bet.subject || "");
  const urls = [
    `https://site.web.api.espn.com/apis/search/v2?query=${q}&limit=25`,
    `https://site.web.api.espn.com/apis/common/v3/search?query=${q}&limit=15`
  ];
  for (const url of urls) {
    try {
      const data = await getJson(url);
      const id = idFromBlob(data, bet.sport);
      if (id) return id;
    } catch (_) {}
  }
  return null;
}

async function refreshPlayer(bet) {
  if (!bet || bet.kind === "award" || !bet.stat) return false;
  const id = await resolveAthleteId(bet);
  if (!id) return false;
  const year = new Date().getFullYear();
  const path = (bet.sport === "ncaaf") ? "football/college-football" : "football/nfl";
  const league = (bet.sport === "ncaaf") ? "college-football" : "nfl";
  const urls = [
    `https://sports.core.api.espn.com/v2/sports/football/leagues/${league}/seasons/${year}/types/2/athletes/${id}/statistics`,
    `https://site.web.api.espn.com/apis/common/v3/sports/${path}/athletes/${id}/splits?season=${year}`,
    `https://site.web.api.espn.com/apis/common/v3/sports/${path}/athletes/${id}/stats?season=${year}&seasontype=2`,
    `https://site.web.api.espn.com/apis/common/v3/sports/${path}/athletes/${id}/gamelog`
  ];
  for (const url of urls) {
    try {
      const data = await getJson(url);
      let value = namedValue(data, bet.stat);
      if (value == null && url.includes("gamelog")) value = sumGamelog(data, bet.stat);
      if (value == null) continue;
      bet.current = value;
      bet.espnAthleteId = id;
      bet.lastSync = new Date().toISOString();
      const t = Number(bet.target) || 1;
      if ((bet.status || "open") === "open" && (Number(bet.current) / t) >= 1) bet.status = "hit";
      return true;
    } catch (_) {}
  }
  return false;
}

if (typeof module !== "undefined") {
  module.exports = { refreshPlayer, resolveAthleteId, namedValue, sumGamelog };
}
if (typeof window !== "undefined") {
  window.EspnPlayer = { refreshPlayer, resolveAthleteId };
}
