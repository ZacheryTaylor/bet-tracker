function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function walkEntries(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((item) => walkEntries(item, acc));
    return acc;
  }
  if (node.team && (Array.isArray(node.stats) || node.team.record)) acc.push(node);
  for (const key of ["children", "standings", "entries"]) {
    if (node[key]) walkEntries(node[key], acc);
  }
  return acc;
}

function teamMatches(entry, teamName) {
  const q = norm(teamName);
  const team = entry.team || {};
  const names = [team.displayName, team.shortDisplayName, team.abbreviation, team.name, team.nickname, team.location];
  return names.some((name) => {
    const value = norm(name);
    return value && (value === q || value.includes(q) || q.includes(value));
  });
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function summaryRecord(summary) {
  const match = String(summary || "").match(/^(\d+)-(\d+)(?:-(\d+))?/);
  if (!match) return null;
  return { wins: Number(match[1]), losses: Number(match[2]), ties: Number(match[3] || 0) };
}

function getOverallRecord(entry) {
  const teamRecords = entry.team?.record?.items || [];
  const overallItem = teamRecords.find((item) => /overall|total|regular/i.test(`${item.type || ""} ${item.name || ""} ${item.description || ""}`));
  const fromTeamRecord = summaryRecord((overallItem || teamRecords[0] || {}).summary);
  if (fromTeamRecord) return fromTeamRecord;

  const stats = Array.isArray(entry.stats) ? entry.stats : [];
  const overallStats = stats.filter((stat) => {
    const scope = `${stat.type || ""} ${stat.name || ""} ${stat.displayName || ""} ${stat.description || ""}`.toLowerCase();
    return !/home|away|division|conference|last|vs\.?|streak|playoff|preseason/.test(scope);
  });
  const read = (name) => {
    const exact = overallStats.find((stat) => String(stat.name || "").toLowerCase() === name);
    return exact ? num(exact.value) : null;
  };
  const wins = read("wins");
  const losses = read("losses");
  const ties = read("ties");
  if (wins !== null || losses !== null) return { wins: wins || 0, losses: losses || 0, ties: ties || 0 };

  const direct = summaryRecord(entry.record?.summary || entry.summary);
  return direct;
}

function findOverallRecord(data, teamName) {
  const matches = walkEntries(data).filter((entry) => teamMatches(entry, teamName));
  for (const entry of matches) {
    const record = getOverallRecord(entry);
    if (record) return record;
  }
  return null;
}

if (typeof module !== "undefined") module.exports = { findOverallRecord };
if (typeof window !== "undefined") window.TeamRecord = { findOverallRecord };
