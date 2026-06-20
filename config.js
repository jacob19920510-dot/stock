const fs = require("node:fs/promises");
const path = require("node:path");
const { cloneGlobalMarketOptions, normalizeGlobalMarketSlots } = require("./globalMarket");
const { cloneMarketWindGroups, defaultMarketWindSlots, normalizeMarketWindSlots } = require("./windMarket");

const CONFIG_PATH = path.join(__dirname, "config.json");

async function readConfig() {
  const text = await fs.readFile(CONFIG_PATH, "utf8");
  const config = JSON.parse(text);
  return {
    refreshSeconds: Number(config.refreshSeconds) || 30,
    groups: normalizeGroups(config.groups),
    watchlists: normalizeWatchlists(config),
    marketWind: normalizeMarketWind(config.marketWind),
  };
}

async function writeConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function watchlist(config) {
  return findWatchlist(config);
}

function normalizeGroups(groups) {
  return (Array.isArray(groups) ? groups : []).filter(group => group?.name !== "自選股");
}

function normalizeSymbols(symbols) {
  return (Array.isArray(symbols) ? symbols : [])
    .filter(Boolean)
    .map(item => ({
      symbol: cleanSymbol(item.symbol),
      name: String(item.name || item.symbol || "").trim().slice(0, 80),
      type: String(item.type || "").trim().slice(0, 20),
    }))
    .filter(item => item.symbol);
}

function makeWatchlistId(name, used = new Set()) {
  const base = String(name || "watchlist")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) || "watchlist";
  let id = base, index = 2;
  while (used.has(id)) id = `${base}-${index++}`;
  used.add(id);
  return id;
}

function normalizeWatchlists(config) {
  const used = new Set();
  const legacy = (Array.isArray(config.groups) ? config.groups : []).find(group => group?.name === "自選股");
  const legacySymbols = normalizeSymbols(legacy?.symbols);
  let rows = Array.isArray(config.watchlists) ? config.watchlists : [];
  if (!rows.length) {
    rows = [{ id: "default", name: "自選股", symbols: legacySymbols }];
  } else if (legacySymbols.length && !rows.some(row => normalizeSymbols(row?.symbols).length)) {
    rows = rows.map((row, index) => index === 0 ? { ...row, symbols: legacySymbols } : row);
  }
  const watchlists = rows.map((row, index) => {
    const name = String(row?.name || (index === 0 ? "自選股" : "未命名清單")).trim().slice(0, 40) || "自選股";
    const rawId = String(row?.id || "").trim().slice(0, 40);
    const id = rawId && !used.has(rawId) ? rawId : makeWatchlistId(name, used);
    used.add(id);
    return {
      id,
      name,
      locked: index === 0 || Boolean(row?.locked),
      symbols: normalizeSymbols(row?.symbols),
    };
  });
  return watchlists.length ? watchlists : [{ id: "default", name: "自選股", locked: true, symbols: [] }];
}

function defaultWatchlistId(config) {
  return normalizeWatchlists(config)[0].id;
}

function findWatchlist(config, id) {
  if (!Array.isArray(config.watchlists) || !config.watchlists.length) config.watchlists = normalizeWatchlists(config);
  const target = String(id || config.watchlists[0]?.id || "").trim();
  const list = config.watchlists.find(row => row.id === target) || config.watchlists[0];
  if (!list) throw new Error("watchlist not found");
  if (!Array.isArray(list.symbols)) list.symbols = [];
  return list;
}

function ensureUniqueWatchlistName(config, name, currentId = "") {
  const label = String(name || "").trim().slice(0, 40);
  if (!label) throw new Error("missing watchlist name");
  const exists = (config.watchlists || []).some(row => row.id !== currentId && row.name.trim().toLowerCase() === label.toLowerCase());
  if (exists) throw new Error("watchlist name already exists");
  return label;
}

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().slice(0, 24);
}

function marketType(symbol, meta = {}) {
  if (symbol.endsWith(".TW") || symbol.endsWith(".TWO") || meta.exchangeName === "TAI" || meta.exchangeName === "TWO") return "\u53f0\u80a1";
  if (symbol.startsWith("^")) return "\u6307\u6578";
  if (symbol.endsWith("=F") || symbol.includes("&")) return "\u671f\u8ca8";
  if (meta.instrumentType === "INDEX") return "\u6307\u6578";
  if (meta.instrumentType === "FUTURE" || meta.quoteType === "FUTURE_INDEX" || meta.exchange === "TFE") return "\u671f\u8ca8";
  if (!symbol.includes(".")) return "\u7f8e\u80a1";
  return "\u5176\u4ed6";
}

function canWatch(type, symbol) {
  if (symbol.startsWith("^") || symbol.endsWith("=F") || symbol.includes("&")) return false;
  const kind = String(type || marketType(symbol)).trim();
  return kind !== "\u6307\u6578" && kind !== "\u671f\u8ca8";
}

function indexGroup(config) {
  let group = config.groups.find(g => g.name === "\u6307\u6578");
  if (!group) {
    group = { name: "\u6307\u6578", symbols: [] };
    config.groups.push(group);
  }
  if (!Array.isArray(group.symbols)) group.symbols = [];
  return group;
}

function normalizeMarketWind(marketWind) {
  return { slots: normalizeMarketWindSlots(marketWind?.slots || defaultMarketWindSlots()) };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function addWatchSymbol(req, watchlistId) {
  const body = await readBody(req);
  const symbol = cleanSymbol(body.symbol);
  if (!symbol) throw new Error("missing symbol");
  const type = String(body.type || marketType(symbol)).trim().slice(0, 20);
  if (!canWatch(type, symbol)) throw new Error("cannot add this type to watchlist");

  const config = await readConfig();
  const list = findWatchlist(config, watchlistId);
  if (!list.symbols.some(x => cleanSymbol(x.symbol) === symbol)) {
    list.symbols.push({
      symbol,
      name: String(body.name || symbol).trim().slice(0, 80),
      type,
    });
    await writeConfig(config);
  }
  return { ok: true };
}

async function removeWatchSymbol(req, watchlistId) {
  const body = await readBody(req);
  const symbol = cleanSymbol(body.symbol);
  const config = await readConfig();
  const list = findWatchlist(config, watchlistId);
  list.symbols = list.symbols.filter(x => cleanSymbol(x.symbol) !== symbol);
  await writeConfig(config);
  return { ok: true };
}

async function reorderWatchSymbols(req, watchlistId) {
  const body = await readBody(req);
  const order = Array.isArray(body.symbols) ? body.symbols.map(cleanSymbol).filter(Boolean) : [];
  const config = await readConfig();
  const list = findWatchlist(config, watchlistId);
  const bySymbol = new Map(list.symbols.map(item => [cleanSymbol(item.symbol), item]));
  list.symbols = [...order.map(symbol => bySymbol.get(symbol)).filter(Boolean), ...list.symbols.filter(item => !order.includes(cleanSymbol(item.symbol)))];
  await writeConfig(config);
  return { ok: true };
}

async function reorderWatchlists(req) {
  const body = await readBody(req);
  const order = Array.isArray(body.watchlistIds) ? body.watchlistIds.map(id => String(id || "").trim()).filter(Boolean) : [];
  const config = await readConfig();
  const byId = new Map(config.watchlists.map(item => [item.id, item]));
  const seen = new Set();
  const reordered = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    reordered.push(item);
    seen.add(id);
  }
  for (const item of config.watchlists) {
    if (seen.has(item.id)) continue;
    reordered.push(item);
    seen.add(item.id);
  }
  if (!reordered.length) throw new Error("at least one watchlist is required");
  config.watchlists = reordered;
  await writeConfig(config);
  return { ok: true, watchlists: config.watchlists };
}

async function readWatchlists() {
  const config = await readConfig();
  return { ok: true, watchlists: config.watchlists };
}

async function createWatchlist(req) {
  const body = await readBody(req);
  const config = await readConfig();
  const name = ensureUniqueWatchlistName(config, body.name || "新清單");
  const used = new Set(config.watchlists.map(row => row.id));
  const list = { id: makeWatchlistId(name, used), name, locked: false, symbols: [] };
  config.watchlists.push(list);
  await writeConfig(config);
  return { ok: true, watchlist: list, watchlists: config.watchlists };
}

async function updateWatchlist(req, id) {
  const body = await readBody(req);
  const config = await readConfig();
  const list = findWatchlist(config, id);
  list.name = ensureUniqueWatchlistName(config, body.name, list.id);
  await writeConfig(config);
  return { ok: true, watchlist: list, watchlists: config.watchlists };
}

async function deleteWatchlist(id) {
  const config = await readConfig();
  if (config.watchlists.length <= 1) throw new Error("at least one watchlist is required");
  const list = findWatchlist(config, id);
  config.watchlists = config.watchlists.filter(row => row.id !== list.id);
  await writeConfig(config);
  return { ok: true, watchlists: config.watchlists };
}

async function readGlobalMarket() {
  const config = await readConfig();
  const group = indexGroup(config);
  return {
    slots: normalizeGlobalMarketSlots(group.symbols),
    options: cloneGlobalMarketOptions(),
  };
}

async function updateGlobalMarket(req) {
  const body = await readBody(req);
  const slots = normalizeGlobalMarketSlots(body.slots || body.symbols, { strict: true });
  const config = await readConfig();
  const group = indexGroup(config);
  group.symbols = slots;
  await writeConfig(config);
  return {
    ok: true,
    slots,
    options: cloneGlobalMarketOptions(),
  };
}

async function readMarketWind() {
  const config = await readConfig();
  return { slots: normalizeMarketWindSlots(config.marketWind?.slots), groups: cloneMarketWindGroups() };
}

async function updateMarketWind(req) {
  const body = await readBody(req);
  const slots = normalizeMarketWindSlots(body.slots, { strict: true });
  const config = await readConfig();
  config.marketWind = { slots };
  await writeConfig(config);
  return { ok: true, slots, groups: cloneMarketWindGroups() };
}

module.exports = {
  readConfig,
  writeConfig,
  watchlist,
  indexGroup,
  defaultWatchlistId,
  readWatchlists,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  addWatchSymbol,
  removeWatchSymbol,
  reorderWatchSymbols,
  reorderWatchlists,
  readGlobalMarket,
  updateGlobalMarket,
  readMarketWind,
  updateMarketWind,
};
