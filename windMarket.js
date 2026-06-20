const MARKET_WIND_SLOT_COUNT = 6;

const MARKET_WIND_GROUPS = [
  {
    name: "期貨",
    options: [
      { symbol: "ES=F", name: "標普500期貨", type: "期貨" },
      { symbol: "NQ=F", name: "那斯達克期貨", type: "期貨" },
      { symbol: "WTX&", name: "台指期近一", type: "期貨" },
      { symbol: "YM=F", name: "道瓊期貨", type: "期貨" },
      { symbol: "NKD=F", name: "日經期貨", type: "期貨" },
    ],
  },
  {
    name: "商品",
    options: [
      { symbol: "GC=F", name: "黃金", type: "商品" },
      { symbol: "SI=F", name: "白銀", type: "商品" },
      { symbol: "HG=F", name: "銅", type: "商品" },
      { symbol: "CL=F", name: "原油", type: "商品" },
      { symbol: "NG=F", name: "天然氣", type: "商品" },
    ],
  },
  {
    name: "匯率",
    options: [
      { symbol: "USDTWD=X", name: "美元/新台幣", type: "匯率" },
      { symbol: "JPYTWD=X", name: "日元/新台幣", type: "匯率" },
      { symbol: "CNYTWD=X", name: "人民幣/新台幣", type: "匯率" },
      { symbol: "ZARTWD=X", name: "南非幣/新台幣", type: "匯率" },
      { symbol: "EURTWD=X", name: "歐元/新台幣", type: "匯率" },
    ],
  },
  {
    name: "加密貨幣",
    options: [
      { symbol: "BTC-USD", name: "比特幣 BTC", type: "加密貨幣" },
      { symbol: "ETH-USD", name: "以太幣 ETH", type: "加密貨幣" },
    ],
  },
];

const MARKET_WIND_OPTION_MAP = new Map(
  MARKET_WIND_GROUPS.flatMap(group => group.options.map(option => [option.symbol, { ...option, group: group.name }]))
);

const DEFAULT_MARKET_WIND_SYMBOLS = [
  "ES=F",
  "NQ=F",
  "WTX&",
  "YM=F",
  "GC=F",
  "BTC-USD",
];

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().slice(0, 24);
}

function normalizeMarketWindSlot(slot, { strict = false } = {}) {
  if (!slot) return null;
  const rawSymbol = typeof slot === "string" ? slot : slot.symbol;
  const symbol = cleanSymbol(rawSymbol);
  if (!symbol) return null;
  const known = MARKET_WIND_OPTION_MAP.get(symbol);
  if (!known) {
    if (strict) throw new Error(`unsupported market wind symbol: ${symbol}`);
    return {
      symbol,
      name: String(slot.name || symbol).trim().slice(0, 80),
      type: String(slot.type || "指標").trim().slice(0, 20) || "指標",
    };
  }
  return {
    symbol: known.symbol,
    name: known.name,
    type: known.type,
    group: known.group,
  };
}

function normalizeMarketWindSlots(slots, { strict = false } = {}) {
  if (strict && Array.isArray(slots) && slots.length > MARKET_WIND_SLOT_COUNT) {
    throw new Error(`market wind supports at most ${MARKET_WIND_SLOT_COUNT} slots`);
  }
  const raw = Array.isArray(slots) ? slots.slice(0, MARKET_WIND_SLOT_COUNT) : [];
  const used = new Set();
  const normalized = raw.map(slot => {
    const normalizedSlot = normalizeMarketWindSlot(slot, { strict });
    if (!normalizedSlot) return null;
    if (used.has(normalizedSlot.symbol)) {
      if (strict) throw new Error(`duplicate market wind symbol: ${normalizedSlot.symbol}`);
      return null;
    }
    used.add(normalizedSlot.symbol);
    return normalizedSlot;
  });
  while (normalized.length < MARKET_WIND_SLOT_COUNT) normalized.push(null);
  return normalized;
}

function defaultMarketWindSlots() {
  return normalizeMarketWindSlots(DEFAULT_MARKET_WIND_SYMBOLS);
}

function cloneMarketWindGroups() {
  return MARKET_WIND_GROUPS.map(group => ({
    name: group.name,
    options: group.options.map(option => ({ ...option })),
  }));
}

module.exports = {
  MARKET_WIND_SLOT_COUNT,
  MARKET_WIND_GROUPS,
  MARKET_WIND_OPTION_MAP,
  DEFAULT_MARKET_WIND_SYMBOLS,
  defaultMarketWindSlots,
  cloneMarketWindGroups,
  normalizeMarketWindSlot,
  normalizeMarketWindSlots,
};
