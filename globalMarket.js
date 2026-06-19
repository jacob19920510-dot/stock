const GLOBAL_MARKET_SLOT_COUNT = 5;

const GLOBAL_MARKET_OPTIONS = [
  { symbol: "^TWII", name: "台灣加權指數", type: "指數", region: "台灣" },
  { symbol: "^N225", name: "日經225指數", type: "指數", region: "日本" },
  { symbol: "^KS11", name: "韓國綜合指數", type: "指數", region: "韓國" },
  { symbol: "^HSI", name: "香港恆生指數", type: "指數", region: "香港" },
  { symbol: "000001.SS", name: "上海綜合指數", type: "指數", region: "中國" },
  { symbol: "399001.SZ", name: "深圳綜合指數", type: "指數", region: "中國" },
  { symbol: "^GSPC", name: "標普500指數", type: "指數", region: "美國" },
  { symbol: "^NDX", name: "納斯達克100指數", type: "指數", region: "美國" },
  { symbol: "^DJI", name: "道瓊工業指數", type: "指數", region: "美國" },
  { symbol: "^SOX", name: "費城半導體指數", type: "指數", region: "美國" },
  { symbol: "^VIX", name: "VIX 恐慌指數", type: "指數", region: "美國" },
  { symbol: "^FTSE", name: "英國富時100指數", type: "指數", region: "歐洲" },
  { symbol: "^GDAXI", name: "德國DAX指數", type: "指數", region: "歐洲" },
  { symbol: "^FCHI", name: "法國CAC40指數", type: "指數", region: "歐洲" },
  { symbol: "^STOXX50E", name: "歐洲藍籌50指數", type: "指數", region: "歐洲" },
];

const GLOBAL_MARKET_OPTION_MAP = new Map(GLOBAL_MARKET_OPTIONS.map(option => [option.symbol, option]));

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().slice(0, 24);
}

function normalizeGlobalMarketSlot(slot, { strict = false } = {}) {
  if (!slot) return null;
  const rawSymbol = typeof slot === "string" ? slot : slot.symbol;
  const symbol = cleanSymbol(rawSymbol);
  if (!symbol) return null;
  const known = GLOBAL_MARKET_OPTION_MAP.get(symbol);
  if (!known) {
    if (strict) throw new Error(`unsupported global market symbol: ${symbol}`);
    return {
      symbol,
      name: String(slot.name || symbol).trim().slice(0, 80),
      type: String(slot.type || "指數").trim().slice(0, 20) || "指數",
    };
  }
  return {
    symbol: known.symbol,
    name: known.name,
    type: known.type,
    region: known.region,
  };
}

function normalizeGlobalMarketSlots(slots, { strict = false } = {}) {
  const raw = Array.isArray(slots) ? slots.slice(0, GLOBAL_MARKET_SLOT_COUNT) : [];
  const normalized = raw.map(slot => normalizeGlobalMarketSlot(slot, { strict }));
  while (normalized.length < GLOBAL_MARKET_SLOT_COUNT) normalized.push(null);
  return normalized;
}

function cloneGlobalMarketOptions() {
  return GLOBAL_MARKET_OPTIONS.map(option => ({ ...option }));
}

module.exports = {
  GLOBAL_MARKET_SLOT_COUNT,
  GLOBAL_MARKET_OPTIONS,
  GLOBAL_MARKET_OPTION_MAP,
  cloneGlobalMarketOptions,
  normalizeGlobalMarketSlot,
  normalizeGlobalMarketSlots,
};
