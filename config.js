const fs = require("node:fs/promises");
const path = require("node:path");
const { cloneGlobalMarketOptions, normalizeGlobalMarketSlots } = require("./globalMarket");

const CONFIG_PATH = path.join(__dirname, "config.json");

async function readConfig() {
  const text = await fs.readFile(CONFIG_PATH, "utf8");
  const config = JSON.parse(text);
  return {
    refreshSeconds: Number(config.refreshSeconds) || 30,
    groups: Array.isArray(config.groups) ? config.groups : [],
  };
}

async function writeConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function watchlist(config) {
  let group = config.groups.find(g => g.name === "自選股");
  if (!group) {
    group = { name: "自選股", symbols: [] };
    config.groups.unshift(group);
  }
  if (!Array.isArray(group.symbols)) group.symbols = [];
  return group;
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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function addWatchSymbol(req) {
  const body = await readBody(req);
  const symbol = cleanSymbol(body.symbol);
  if (!symbol) throw new Error("missing symbol");
  const type = String(body.type || marketType(symbol)).trim().slice(0, 20);
  if (!canWatch(type, symbol)) throw new Error("cannot add this type to watchlist");

  const config = await readConfig();
  const group = watchlist(config);
  if (!group.symbols.some(x => cleanSymbol(x.symbol) === symbol)) {
    group.symbols.push({
      symbol,
      name: String(body.name || symbol).trim().slice(0, 80),
      type,
    });
    await writeConfig(config);
  }
  return { ok: true };
}

async function removeWatchSymbol(req) {
  const body = await readBody(req);
  const symbol = cleanSymbol(body.symbol);
  const config = await readConfig();
  const group = watchlist(config);
  group.symbols = group.symbols.filter(x => cleanSymbol(x.symbol) !== symbol);
  await writeConfig(config);
  return { ok: true };
}

async function reorderWatchSymbols(req) {
  const body = await readBody(req);
  const order = Array.isArray(body.symbols) ? body.symbols.map(cleanSymbol).filter(Boolean) : [];
  const config = await readConfig();
  const group = watchlist(config);
  const bySymbol = new Map(group.symbols.map(item => [cleanSymbol(item.symbol), item]));
  group.symbols = [...order.map(symbol => bySymbol.get(symbol)).filter(Boolean), ...group.symbols.filter(item => !order.includes(cleanSymbol(item.symbol)))];
  await writeConfig(config);
  return { ok: true };
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

module.exports = {
  readConfig,
  writeConfig,
  watchlist,
  indexGroup,
  addWatchSymbol,
  removeWatchSymbol,
  reorderWatchSymbols,
  readGlobalMarket,
  updateGlobalMarket,
};
