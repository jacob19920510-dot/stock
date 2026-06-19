const { readConfig } = require("../config");
const { hasChinese, twName, twUniverse, twseCodeQuery, twSharesOutstanding } = require("./twse");

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().slice(0, 24);
}

function marketType(symbol, meta = {}) {
  if (symbol.endsWith(".TW") || symbol.endsWith(".TWO") || meta.exchangeName === "TAI" || meta.exchangeName === "TWO") return "台股";
  if (meta.instrumentType === "INDEX") return "指數";
  if (meta.instrumentType === "FUTURE" || meta.quoteType === "FUTURE_INDEX" || meta.exchange === "TFE") return "期貨";
  if (!symbol.includes(".")) return "美股";
  return "其他";
}

function isTwFuture(symbol) {
  return String(symbol || "").includes("&");
}

function parseJsonObject(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
    else { if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } } } }
  }
  return null;
}

const twFutureCache = new Map();

// Yahoo 國際版 chart API 不支援台灣期貨（如 WTX&），改從 Yahoo 台灣個股頁內嵌的
// libra JSON 取得 meta 與分時 K 線，回傳結構與 fetchChart 一致。
async function fetchTwFutureChart(symbol) {
  const clean = cleanSymbol(symbol);
  const cached = twFutureCache.get(clean);
  if (cached && Date.now() - cached.time < 30000) return cached.result;
  const url = `https://tw.stock.yahoo.com/quote/${encodeURIComponent(clean)}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
  if (!res.ok) throw new Error(`Yahoo TW ${res.status}`);
  const html = await res.text();
  const libraIdx = html.indexOf('"libra":{');
  if (libraIdx < 0) throw new Error("no libra data");
  const libra = parseJsonObject(html, libraIdx + '"libra":'.length);
  const data = libra && libra[clean];
  if (!data || !data.meta) throw new Error("no quote");

  const quote = data.indicators?.quote?.[0] || {};
  const candles = (data.timestamp || []).map((time, i) => ({
    time: time * 1000,
    open: numberOrNull(quote.open?.[i]),
    high: numberOrNull(quote.high?.[i]),
    low: numberOrNull(quote.low?.[i]),
    close: numberOrNull(quote.close?.[i]),
    volume: numberOrNull(quote.volume?.[i]),
  })).filter(x => [x.open, x.high, x.low, x.close].every(v => Number.isFinite(v) && v > 0));

  const meta = { ...data.meta };
  if (candles.length) {
    meta.regularMarketOpen = candles[0].open;
    meta.regularMarketDayHigh = Math.max(...candles.map(c => c.high));
    meta.regularMarketDayLow = Math.min(...candles.map(c => c.low));
    meta.regularMarketVolume = candles.reduce((sum, c) => sum + (Number.isFinite(c.volume) ? c.volume : 0), 0);
  }

  const result = { meta, candles };
  twFutureCache.set(clean, { time: Date.now(), result });
  return result;
}

const twFutureHistoryCache = new Map();
const rankingsCache = new Map();

const GLOBAL_INDEX_RANKING_UNIVERSE = [
  ["^TWII", "\u53f0\u7063\u52a0\u6b0a\u6307\u6578"], ["^DJI", "\u9053\u74ca\u5de5\u696d\u6307\u6578"], ["^GSPC", "S&P 500\u6307\u6578"],
  ["^IXIC", "NASDAQ\u7d9c\u5408\u6307\u6578"], ["^NDX", "NASDAQ 100\u6307\u6578"], ["^SOX", "\u8cbb\u57ce\u534a\u5c0e\u9ad4\u6307\u6578"],
  ["^N225", "\u65e5\u7d93225\u6307\u6578"], ["^HSI", "\u9999\u6e2f\u6046\u751f\u6307\u6578"], ["000001.SS", "\u4e0a\u6d77\u7d9c\u5408\u6307\u6578"],
  ["399001.SZ", "\u6df1\u5733\u7d9c\u5408\u6307\u6578"], ["^KS11", "\u97d3\u570b\u7d9c\u5408\u6307\u6578"], ["^STI", "\u65b0\u52a0\u5761\u6d77\u5cfd\u6642\u5831\u6307\u6578"],
  ["^BSESN", "\u5370\u5ea6\u5b5f\u8cb7\u6307\u6578"], ["^JKSE", "\u5370\u5c3c\u7d9c\u5408\u6307\u6578"], ["^KLSE", "\u99ac\u4f86\u897f\u4e9e\u6307\u6578"],
  ["PSEI.PS", "\u83f2\u5f8b\u8cd3\u7d9c\u5408\u6307\u6578"], ["^GDAXI", "\u5fb7\u570bDAX\u6307\u6578"], ["^FTSE", "\u82f1\u570bFTSE 100\u6307\u6578"],
  ["^FCHI", "\u6cd5\u570bCAC 40\u6307\u6578"], ["^STOXX50E", "\u6b50\u6d32\u85cd\u7c4c50\u6307\u6578"], ["RTSI.ME", "\u4fc4\u7f85\u65afRTS\u6307\u6578"],
  ["^BVSP", "\u5df4\u897fBovespa\u6307\u6578"], ["^MXX", "\u58a8\u897f\u54e5IPC\u6307\u6578"], ["^GSPTSE", "\u52a0\u62ff\u5927S&P/TSX\u6307\u6578"],
];

const TW_RANKING_PAGES = {
  gainers: ["change-up", 1],
  losers: ["change-down", -1],
  volume: ["volume", 0],
};

const US_SCREENER_IDS = {
  gainers: "day_gainers",
  losers: "day_losers",
  volume: "most_actives",
};

const TW_TURNOVER_THRESHOLD_YI = 5;
const TW_MARKET_CAP_THRESHOLD_TWD = 50_000_000_000;
const US_LARGE_CAP_THRESHOLD = 10_000_000_000;
const US_DOLLAR_VOLUME_FALLBACK = 100_000_000;

const RANKING_UNIVERSE = {
  tw: [
    ["2330.TW", "台積電"], ["2454.TW", "聯發科"], ["2317.TW", "鴻海"], ["2308.TW", "台達電"],
    ["2412.TW", "中華電"], ["2881.TW", "富邦金"], ["2882.TW", "國泰金"], ["2891.TW", "中信金"],
    ["2303.TW", "聯電"], ["3711.TW", "日月光投控"], ["2603.TW", "長榮"], ["1216.TW", "統一"],
    ["6669.TW", "緯穎"], ["3037.TW", "欣興"], ["2355.TW", "敬鵬"],
  ],
  us: [
    ["NVDA", "NVIDIA"], ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["AMZN", "Amazon"],
    ["META", "Meta"], ["GOOGL", "Alphabet"], ["TSLA", "Tesla"], ["AVGO", "Broadcom"],
    ["AMD", "AMD"], ["NFLX", "Netflix"], ["QQQ", "Invesco QQQ ETF"], ["SPY", "SPDR S&P 500 ETF"],
  ],
};

const GLOBAL_INDEX_UNIVERSE = [
  ["^TWII", "台灣加權指數"], ["^GSPC", "標普500指數"], ["^NDX", "納斯達克100指數"],
  ["^DJI", "道瓊指數"], ["^SOX", "費城半導體指數"], ["^N225", "日經225指數"],
  ["^HSI", "香港恆生指數"], ["^FTSE", "英國富時100指數"], ["^GDAXI", "德國DAX指數"],
  ["^FCHI", "法國CAC40指數"],
];

// 台指期歷史 K 線：Yahoo 台灣技術分析頁使用的 ApacLibraCharts API，
// period=d/w/m 對應日/週/月 K，回傳結構與 fetchChart 一致。
async function fetchTwFutureHistory(symbol, period = "d") {
  const clean = cleanSymbol(symbol);
  const key = `${clean}:${period}`;
  const cached = twFutureHistoryCache.get(key);
  if (cached && Date.now() - cached.time < 60000) return cached.result;
  const symbols = JSON.stringify([clean]);
  const params = new URLSearchParams({
    bkt: "twhk-caas-nwapi", device: "desktop", ecma: "modern",
    feature: "enableGAMAds,enableGAMEdgeToEdge,enableEvPlayer,enableTxnToken,useCG,useCGV2,enableNetworkApiValidate,useNetworkApi",
    intl: "tw", lang: "zh-Hant-TW", partner: "none", prid: "stock-dashboard",
    region: "TW", site: "finance", tz: "Asia/Taipei", ver: "1.4.883", returnMeta: "true",
  });
  const url = `https://tw.stock.yahoo.com/_td-stock/api/resource/FinanceChartService.ApacLibraCharts;period=${encodeURIComponent(period)};symbols=${encodeURIComponent(symbols)}?${params}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "referer": `https://tw.stock.yahoo.com/quote/${encodeURIComponent(clean)}/technical-analysis` } });
  if (!res.ok) throw new Error(`Yahoo TW history ${res.status}`);
  const data = await res.json();
  const chart = data.data?.[0]?.chart;
  if (!chart || !chart.meta) throw new Error("no history data");

  const quote = chart.indicators?.quote?.[0] || {};
  const candles = (chart.timestamp || []).map((time, i) => ({
    time: time * 1000,
    open: numberOrNull(quote.open?.[i]),
    high: numberOrNull(quote.high?.[i]),
    low: numberOrNull(quote.low?.[i]),
    close: numberOrNull(quote.close?.[i]),
    volume: numberOrNull(quote.volume?.[i]),
  })).filter(x => [x.open, x.high, x.low, x.close].every(v => Number.isFinite(v) && v > 0));

  const result = { meta: chart.meta, candles };
  twFutureHistoryCache.set(key, { time: Date.now(), result });
  return result;
}

async function fetchChart(symbol, range = "1d", interval = "1m") {
  const clean = cleanSymbol(symbol);
  if (!clean) throw new Error("missing symbol");
  if (isTwFuture(clean)) return fetchTwFutureChart(clean);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { "user-agent": "stock-dashboard/1.0" } });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const data = await res.json();
  const result = data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.meta) throw new Error(data.chart?.error?.description || "no quote");

  const quote = result.indicators?.quote?.[0] || {};
  const candles = (result.timestamp || []).map((time, i) => ({
    time: time * 1000,
    open: numberOrNull(quote.open?.[i]),
    high: numberOrNull(quote.high?.[i]),
    low: numberOrNull(quote.low?.[i]),
    close: numberOrNull(quote.close?.[i]),
    volume: numberOrNull(quote.volume?.[i]),
  })).filter(x =>
    [x.open, x.high, x.low, x.close].every(v => Number.isFinite(v) && v > 0)
  );

  return { meta: result.meta, candles };
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchQuote(item) {
  const symbol = cleanSymbol(item.symbol);
  const { meta, candles } = await fetchChart(symbol, "1d", "1m");
  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.previousClose || meta.chartPreviousClose);
  const change = Number.isFinite(price) && Number.isFinite(previousClose) ? price - previousClose : null;
  const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;
  const updatedAt = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null;
  const isTw = symbol.endsWith(".TW") || symbol.endsWith(".TWO");

  return {
    name: isTw ? (hasChinese(item.name) ? item.name : await twName(symbol)) || item.name || meta.shortName || symbol : item.name || meta.shortName || meta.name || symbol,
    symbol,
    type: item.type || marketType(symbol, meta),
    price,
    change,
    changePercent,
    volume: Number(meta.regularMarketVolume),
    shares: Number(item.shares),
    cost: Number(item.cost),
    currency: meta.currency || "",
    market: meta.exchangeName || meta.exchange || "",
    updatedAt,
    sparkline: candles.map(x => ({ time: x.time, close: x.close })).filter(x => Number.isFinite(x.close)),
    ok: true,
  };
}

async function quotesResponse() {
  const config = await readConfig();
  const groups = await Promise.all(config.groups.map(async group => {
    const symbols = Array.isArray(group.symbols) ? group.symbols : [];
    const quotes = await Promise.all(symbols.map(async item => {
      try {
        return await fetchQuote(item);
      } catch (error) {
        return {
          name: item.name || item.symbol || "",
          symbol: item.symbol || "",
          type: item.type || marketType(cleanSymbol(item.symbol || "")),
          ok: false,
          error: error.message,
        };
      }
    }));
    return { name: group.name || "未命名", editable: group.name === "自選股", quotes };
  }));
  return { refreshSeconds: config.refreshSeconds, fetchedAt: new Date().toISOString(), groups };
}

async function rankingResponse() {
  const [tw, us, global] = await Promise.all([
    rankingMarket("tw"),
    rankingMarket("us"),
    rankingGlobal(),
  ]);
  const { meta: twMeta, ...twRows } = tw;
  const { meta: usMeta, ...usRows } = us;
  const meta = { tw: twMeta || {}, us: usMeta || {} };
  if (twMeta?.twFallbackReason) meta.twFallbackReason = twMeta.twFallbackReason;
  return { fetchedAt: new Date().toISOString(), markets: { tw: twRows, us: usRows }, global, meta };
}

async function rankingMarket(market) {
  return cachedRanking(`market:${market}`, async () => {
    if (market === "tw") return fetchTwRankings();
    if (market === "us") return fetchUsRankings();
    const quotes = await fetchRankingQuotes(RANKING_UNIVERSE[market] || []);
    return {
      gainers: quotes.filter(x => Number.isFinite(x.changePercent)).sort((a, b) => b.changePercent - a.changePercent),
      losers: quotes.filter(x => Number.isFinite(x.changePercent)).sort((a, b) => a.changePercent - b.changePercent),
      volume: quotes.filter(x => Number.isFinite(x.volume)).sort((a, b) => b.volume - a.volume),
    };
  });
}

async function rankingGlobal() {
  return cachedRanking("global", async () => {
    const quotes = await fetchRankingQuotes(GLOBAL_INDEX_RANKING_UNIVERSE);
    return quotes.filter(x => Number.isFinite(x.changePercent)).sort((a, b) => b.changePercent - a.changePercent);
  });
}

async function fetchTwRankings() {
  try {
    const [rawGainers, rawLosers, rawVolume, shares] = await Promise.all([
      fetchTwRankingPage("gainers"),
      fetchTwRankingPage("losers"),
      fetchTwRankingPage("volume"),
      twSharesOutstanding(),
    ]);
    const capGainers = withTwMarketCaps(rawGainers, shares);
    const capLosers = withTwMarketCaps(rawLosers, shares);
    const capVolume = withTwMarketCaps(rawVolume, shares);
    const gainers = filterTwHotStocks(capGainers).sort((a, b) => b.changePercent - a.changePercent);
    const losers = filterTwHotStocks(capLosers).sort((a, b) => a.changePercent - b.changePercent);
    const volume = capVolume.filter(isTwCommonStock).sort((a, b) => b.volume - a.volume);
    return { gainers, losers, volume, meta: { turnoverThresholdYi: TW_TURNOVER_THRESHOLD_YI, marketCapThresholdTwd: TW_MARKET_CAP_THRESHOLD_TWD, excludesEtf: true } };
  } catch {
    const [quotes, shares] = await Promise.all([
      fetchRankingQuotes(RANKING_UNIVERSE.tw || []),
      twSharesOutstanding().catch(() => new Map()),
    ]);
    const rows = withTwMarketCaps(quotes, shares).filter(isTwCommonStock);
    return {
      gainers: rows.filter(x => isLargeTwStock(x) && Number.isFinite(x.changePercent)).sort((a, b) => b.changePercent - a.changePercent),
      losers: rows.filter(x => isLargeTwStock(x) && Number.isFinite(x.changePercent)).sort((a, b) => a.changePercent - b.changePercent),
      volume: rows.filter(x => Number.isFinite(x.volume)).sort((a, b) => b.volume - a.volume),
      meta: { twFallbackReason: "missing_turnover", marketCapThresholdTwd: TW_MARKET_CAP_THRESHOLD_TWD, excludesEtf: true },
    };
  }
}

function withTwMarketCaps(rows, shares) {
  return rows.map(row => {
    const shareCount = shares.get(row.symbol);
    const marketCapTwd = Number.isFinite(row.price) && Number.isFinite(shareCount) ? row.price * shareCount : null;
    return { ...row, marketCapTwd };
  });
}

function filterTwHotStocks(rows) {
  return rows
    .filter(isTwCommonStock)
    .filter(x => Number.isFinite(x.turnoverYi) && x.turnoverYi >= TW_TURNOVER_THRESHOLD_YI && isLargeTwStock(x) && Number.isFinite(x.changePercent));
}

function isLargeTwStock(item) {
  return Number.isFinite(item.marketCapTwd) && item.marketCapTwd >= TW_MARKET_CAP_THRESHOLD_TWD;
}

function isTwCommonStock(item) {
  return item && /^[1-9][0-9]{3}\.(TW|TWO)$/.test(String(item.symbol || ""));
}

async function fetchTwRankingPage(kind) {
  const [slug, fixedSign] = TW_RANKING_PAGES[kind];
  const url = `https://tw.stock.yahoo.com/rank/${slug}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
  if (!res.ok) throw new Error(`Yahoo TW rank ${res.status}`);
  const html = await res.text();
  const rows = html.split('<li class="List(n)"').slice(1).map((row, index) => parseTwRankingRow(row, index, fixedSign)).filter(Boolean);
  if (rows.length < 10) throw new Error("Yahoo TW rank parse failed");
  return rows;
}

function parseTwRankingRow(row, index, fixedSign) {
  const symbol = row.match(/quote\/([0-9A-Z]+\.(?:TW|TWO))/)?.[1];
  if (!symbol) return null;
  const name = htmlText(row.match(/<div class="Lh\(20px\)[^"]*">([^<]+)<\/div>/)?.[1] || symbol);
  const stickyEnd = row.indexOf("</div></div></div>");
  const dataPart = stickyEnd >= 0 ? row.slice(stickyEnd + 18) : row;
  const cells = [...dataPart.matchAll(/<div class="Fxg\(1\)[\s\S]*?<\/div>/g)].map(x => htmlText(stripTags(x[0]))).filter(Boolean);
  const price = parseMarketNumber(cells[0]);
  const rawChange = parseMarketNumber(cells[1]);
  const rawChangePercent = parseMarketNumber(cells[2]);
  const volume = parseMarketNumber(cells[6]);
  const turnoverYi = parseMarketNumber(cells[7]);
  const sign = fixedSign || (row.includes("$c-trend-down") ? -1 : 1);
  return {
    rank: index + 1,
    name,
    symbol,
    type: "\u53f0\u80a1",
    price,
    change: Number.isFinite(rawChange) ? rawChange * sign : null,
    changePercent: Number.isFinite(rawChangePercent) ? rawChangePercent * sign : null,
    volume,
    turnoverYi,
    market: symbol.endsWith(".TWO") ? "TWO" : "TAI",
    ok: true,
  };
}

async function fetchUsRankings() {
  try {
    const [rawGainers, rawLosers, volume] = await Promise.all([
      fetchUsScreener("gainers"),
      fetchUsScreener("losers"),
      fetchUsScreener("volume"),
    ]);
    const gainers = filterUsLargeFlow(rawGainers).sort((a, b) => b.changePercent - a.changePercent);
    const losers = filterUsLargeFlow(rawLosers).sort((a, b) => a.changePercent - b.changePercent);
    return { gainers, losers, volume, meta: { largeCapThreshold: US_LARGE_CAP_THRESHOLD, dollarVolumeFallback: US_DOLLAR_VOLUME_FALLBACK } };
  } catch {
    const quotes = await fetchRankingQuotes(RANKING_UNIVERSE.us || []);
    return {
      gainers: quotes.filter(x => Number.isFinite(x.changePercent)).sort((a, b) => b.changePercent - a.changePercent),
      losers: quotes.filter(x => Number.isFinite(x.changePercent)).sort((a, b) => a.changePercent - b.changePercent),
      volume: quotes.filter(x => Number.isFinite(x.volume)).sort((a, b) => b.volume - a.volume),
    };
  }
}

async function fetchUsScreener(kind) {
  const id = US_SCREENER_IDS[kind];
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${encodeURIComponent(id)}&count=100`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
  if (!res.ok) throw new Error(`Yahoo US rank ${res.status}`);
  const data = await res.json();
  const quotes = data.finance?.result?.[0]?.quotes || [];
  const rows = quotes.map((quote, index) => ({
    rank: index + 1,
    name: quote.shortName || quote.longName || quote.symbol,
    symbol: quote.symbol,
    type: "\u7f8e\u80a1",
    price: numberOrNull(quote.regularMarketPrice),
    change: numberOrNull(quote.regularMarketChange),
    changePercent: numberOrNull(quote.regularMarketChangePercent),
    volume: numberOrNull(quote.regularMarketVolume),
    marketCap: numberOrNull(quote.marketCap),
    dollarVolume: Number.isFinite(Number(quote.regularMarketPrice)) && Number.isFinite(Number(quote.regularMarketVolume)) ? Number(quote.regularMarketPrice) * Number(quote.regularMarketVolume) : null,
    market: quote.fullExchangeName || quote.exchange || "",
    currency: quote.currency || "",
    ok: true,
  })).filter(x => x.symbol && Number.isFinite(x.changePercent));
  if (rows.length < 10) throw new Error("Yahoo US rank parse failed");
  return rows;
}

function filterUsLargeFlow(rows) {
  return rows.filter(x => {
    if (Number.isFinite(x.marketCap)) return x.marketCap >= US_LARGE_CAP_THRESHOLD;
    return Number.isFinite(x.dollarVolume) && x.dollarVolume >= US_DOLLAR_VOLUME_FALLBACK;
  });
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function htmlText(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseMarketNumber(value) {
  const n = Number(String(value || "").replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

async function cachedRanking(key, loader) {
  const cached = rankingsCache.get(key);
  if (cached && Date.now() - cached.time < 30000) return cached.value;
  const value = await loader();
  rankingsCache.set(key, { time: Date.now(), value });
  return value;
}

async function fetchRankingQuotes(items) {
  const quotes = await Promise.all(items.map(async ([symbol, name]) => {
    try { return await fetchQuote({ symbol, name }); } catch { return null; }
  }));
  return quotes.filter(Boolean);
}

async function yahooSearch(market, query) {
  const q = String(query || "").trim();
  if (!q) return [];
  if (market === "tw") return twSearch(q);

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
  const res = await fetch(url, { headers: { "user-agent": "stock-dashboard/1.0" } });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);

  const data = await res.json();
  const seen = new Set();
  return (data.quotes || [])
    .filter(x => x.symbol && (x.quoteType === "EQUITY" || x.quoteType === "ETF") && !x.symbol.includes("."))
    .map(x => ({ symbol: x.symbol, name: x.shortname || x.longname || x.symbol, exchange: x.exchange || "", type: "美股" }))
    .filter(x => {
      if (seen.has(x.symbol)) return false;
      seen.add(x.symbol);
      return true;
    })
    .slice(0, 8);
}

async function twSearch(query) {
  let suggestions = await twseCodeQuery(query);
  const q = String(query || "").trim().toUpperCase();
  const nameMatches = hasChinese(query)
    ? (await twUniverse())
      .filter(x => String(x.code).toUpperCase().includes(q) || String(x.name).includes(query))
      .sort((a, b) => twSearchRank(a.code, q, a.name, query) - twSearchRank(b.code, q, b.name, query))
      .slice(0, 24)
    : [];
  suggestions = [...suggestions.map(x => ({ ...x })), ...nameMatches]
    .filter(x => x.name && x.name !== x.code);
  if (/^[0-9A-Z]{4,6}$/.test(q) && !suggestions.some(x => x.code === q)) {
    suggestions.unshift({ code: q, name: "" });
  }
  if (q === "00") suggestions = suggestions.filter(x => x.code >= "0050");
  suggestions.sort((a, b) => twSearchRank(a.code, q, a.name, query) - twSearchRank(b.code, q, b.name, query));

  const found = [];
  const seen = new Set();
  for (const item of suggestions.slice(0, 40)) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    if (!item.suffix && item.code === q && /^[0-9A-Z]{4,6}$/.test(q)) {
      for (const suffix of [".TW", ".TWO"]) {
        try {
          const quote = await fetchQuote({ symbol: item.code + suffix, name: item.name });
          if (!hasChinese(quote.name) || quote.name === item.code || quote.name === quote.symbol) continue;
          found.push({ symbol: quote.symbol, name: quote.name, exchange: quote.market, type: "台股" });
          break;
        } catch {}
      }
      if (found.length >= 8) return found;
      continue;
    }
    const suffix = item.suffix || ".TW";
    found.push({ symbol: item.code + suffix, name: item.name || item.code, exchange: suffix === ".TWO" ? "TWO" : "TAI", type: "台股" });
    if (found.length >= 8) return found;
  }
  return found;
}

function twSearchRank(code, query, name = "", raw = "") {
  if (code === query) return 0;
  if (code === `${query}A`) return 1;
  if (query === "00" && code.startsWith("005")) return 2;
  if (code.startsWith(query) && code.endsWith("A")) return 3;
  if (code.startsWith(query)) return 4;
  if (name === raw) return 5;
  if (String(name).startsWith(raw)) return 6;
  if (String(name).includes(raw)) return 7;
  return 8;
}

async function detailResponse(symbol, name = "", type = "") {
  const clean = cleanSymbol(symbol);
  const twFut = isTwFuture(clean);
  const [{ meta, candles: intraday }, daily] = await Promise.all([
    fetchChart(clean, "1d", "1m"),
    twFut ? fetchTwFutureHistory(clean, "d") : fetchChart(clean, "1y", "1d"),
  ]);
  const quote = await fetchQuote({ symbol: clean, name, type });
  const dailyCandles = daily.candles;
  const last = dailyCandles[dailyCandles.length - 1] || {};
  const avgVolume20 = average(dailyCandles.slice(-20).map(x => x.volume).filter(Number.isFinite));
  const high252 = Math.max(...dailyCandles.map(x => x.high).filter(Number.isFinite));
  const low252 = Math.min(...dailyCandles.map(x => x.low).filter(Number.isFinite));

  return {
    quote,
    session: {
      start: numberOrNull((meta.currentTradingPeriod?.regular?.start || 0) * 1000),
      end: numberOrNull((meta.currentTradingPeriod?.regular?.end || 0) * 1000),
    },
    stats: {
      open: numberOrNull(meta.regularMarketOpen ?? last.open),
      high: numberOrNull(meta.regularMarketDayHigh ?? last.high),
      low: numberOrNull(meta.regularMarketDayLow ?? last.low),
      previousClose: numberOrNull(meta.previousClose || meta.chartPreviousClose),
      volume: numberOrNull(meta.regularMarketVolume ?? last.volume),
      avgVolume20,
      high252: Number.isFinite(high252) ? high252 : null,
      low252: Number.isFinite(low252) ? low252 : null,
      fiftyTwoWeekHigh: numberOrNull(meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: numberOrNull(meta.fiftyTwoWeekLow),
    },
    intraday,
    daily: withMovingAverages(dailyCandles),
  };
}

function average(values) {
  return values.length ? values.reduce((sum, x) => sum + x, 0) / values.length : null;
}

function withMovingAverages(candles) {
  return candles.map((candle, index) => ({
    ...candle,
    ma5: movingAverage(candles, index, 5),
    ma10: movingAverage(candles, index, 10),
    ma20: movingAverage(candles, index, 20),
    ma60: movingAverage(candles, index, 60),
  }));
}

function movingAverage(candles, index, days) {
  if (index + 1 < days) return null;
  const values = candles.slice(index + 1 - days, index + 1).map(x => x.close).filter(Number.isFinite);
  return values.length === days ? average(values) : null;
}

module.exports = {
  cleanSymbol,
  marketType,
  fetchChart,
  fetchQuote,
  quotesResponse,
  rankingResponse,
  yahooSearch,
  detailResponse,
};
