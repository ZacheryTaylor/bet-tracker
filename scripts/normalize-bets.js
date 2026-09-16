function normalizeBets(data) {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (!data || typeof data !== "object") return [];
  if (data.kind) return [data];
  const out = [];
  for (const key of ["playerProp", "teamRecord", "game"]) {
    if (data[key] && typeof data[key] === "object") out.push(data[key]);
  }
  if (out.length) return out;
  return Object.values(data).filter((v) => v && typeof v === "object" && v.kind);
}

if (typeof module !== "undefined") module.exports = { normalizeBets };
