const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8000);
const CONFIG_PATH = path.join(__dirname, "config.json");
const twNameCache = new Map();
let twUniverseCache = null;

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
  if (symbol.endsWith(".TW") || symbol.endsWith(".TWO") || meta.exchangeName === "TAI" || meta.exchangeName === "TWO") return "台股";
  if (meta.instrumentType === "INDEX") return "指數";
  if (meta.instrumentType === "FUTURE") return "期貨";
  if (!symbol.includes(".")) return "美股";
  return "其他";
}

function hasChinese(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function parseTwSuggestions(data) {
  return (data.suggestions || [])
    .map(line => {
      const [code, name] = String(line).split("\t");
      return { code: String(code || "").trim().toUpperCase(), name: String(name || "").trim() };
    })
    .filter(x => /^[0-9A-Z]{4,6}$/.test(x.code) && x.name && !x.code.startsWith("("));
}

async function twseCodeQuery(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const url = `https://www.twse.com.tw/rwd/zh/api/codeQuery?query=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "user-agent": "stock-dashboard/1.0" } });
  if (!res.ok) return [];
  return parseTwSuggestions(await res.json());
}

async function yahooTwName(symbol) {
  try {
    const res = await fetch(`https://tw.stock.yahoo.com/quote/${encodeURIComponent(cleanSymbol(symbol))}`, {
      headers: { "user-agent": "stock-dashboard/1.0" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const title = html.match(/<title>([^<]+)/i)?.[1] || "";
    const name = title.match(/^([^(\s]+)/)?.[1] || "";
    return hasChinese(name) ? name : "";
  } catch {
    return "";
  }
}

async function twName(symbol) {
  const code = cleanSymbol(symbol).replace(/\.(TW|TWO)$/, "");
  if (!code) return "";
  if (twNameCache.has(code)) return twNameCache.get(code);
  const match = (await twseCodeQuery(code)).find(x => x.code === code);
  const name = match ? match.name : await yahooTwName(symbol);
  twNameCache.set(code, name);
  return name;
}

async function twUniverse() {
  if (twUniverseCache && Date.now() - twUniverseCache.time < 86400000) return twUniverseCache.items;
  const [listed, tpex] = await Promise.all([
    fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", { headers: { "user-agent": "stock-dashboard/1.0" } }).then(r => r.ok ? r.json() : []),
    fetch("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes", { headers: { "user-agent": "stock-dashboard/1.0" } }).then(r => r.ok ? r.json() : []),
  ]);
  const items = [
    ...(Array.isArray(listed) ? listed.map(x => ({ code: x.Code, name: x.Name, suffix: ".TW" })) : []),
    ...(Array.isArray(tpex) ? tpex.map(x => ({ code: x.SecuritiesCompanyCode, name: x.CompanyName, suffix: ".TWO" })) : []),
  ].filter(x => /^[0-9A-Z]{4,6}$/.test(String(x.code || "")) && x.name);
  twUniverseCache = { time: Date.now(), items };
  return items;
}

async function fetchChart(symbol, range = "1d", interval = "1m") {
  const clean = cleanSymbol(symbol);
  if (!clean) throw new Error("missing symbol");
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
  const { meta } = await fetchChart(symbol, "1d", "1m");
  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.previousClose || meta.chartPreviousClose);
  const change = Number.isFinite(price) && Number.isFinite(previousClose) ? price - previousClose : null;
  const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;
  const updatedAt = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null;
  const isTw = symbol.endsWith(".TW") || symbol.endsWith(".TWO");

  return {
    name: isTw ? (hasChinese(item.name) ? item.name : await twName(symbol)) || item.name || meta.shortName || symbol : item.name || meta.shortName || symbol,
    symbol,
    type: item.type || marketType(symbol, meta),
    price,
    change,
    changePercent,
    volume: Number(meta.regularMarketVolume),
    shares: Number(item.shares),
    cost: Number(item.cost),
    currency: meta.currency || "",
    market: meta.exchangeName || "",
    updatedAt,
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
  suggestions = [...suggestions.map(x => ({ ...x })), ...nameMatches];
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
          found.push({ symbol: quote.symbol, name: quote.name, exchange: quote.market, type: "台股" });
          break;
        } catch {}
      }
      if (found.length >= 8) return found;
      if (found.some(x => x.symbol.startsWith(item.code + "."))) continue;
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
  const [{ meta, candles: intraday }, daily] = await Promise.all([
    fetchChart(clean, "1d", "5m"),
    fetchChart(clean, "1y", "1d"),
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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function addWatchSymbol(req) {
  const body = await readBody(req);
  const symbol = cleanSymbol(body.symbol);
  if (!symbol) throw new Error("missing symbol");

  const config = await readConfig();
  const group = watchlist(config);
  if (!group.symbols.some(x => cleanSymbol(x.symbol) === symbol)) {
    group.symbols.push({
      symbol,
      name: String(body.name || symbol).trim().slice(0, 80),
      type: String(body.type || marketType(symbol)).trim().slice(0, 20),
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

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8");
}

const page = String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MarketView</title>
  <style>
    :root { --bg:#08111f; --panel:#0e1a2b; --panel2:#101f34; --line:#26384f; --text:#eef4ff; --muted:#8fa3bd; --red:#ff5b52; --green:#38e083; --blue:#5b8cff; --yellow:#f7b955; --purple:#a78bfa; --field:#0a1424; --panel-bg:linear-gradient(180deg,#122137,#0c1728); --chart-bg:#0b1627; }
    body.light { --bg:#f4f7fb; --panel:#fff; --panel2:#f8fbff; --line:#d7e0eb; --text:#122033; --muted:#66788f; --red:#d92d20; --green:#079455; --blue:#2563eb; --field:#fff; --panel-bg:linear-gradient(180deg,#fff,#f7fbff); --chart-bg:#f8fbff; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; background:var(--bg); color:var(--text); transition:background-color .24s ease,color .24s ease; }
    button,input,select { font:inherit; }
    button { cursor:pointer; }
    .shell { min-height:100vh; }
    .side { display:none; }
    .brand { display:flex; align-items:center; gap:10px; font-weight:800; margin:2px 4px 22px; }
    .logo { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#4f8cff,#7c5cff); display:grid; place-items:center; }
    .nav { display:grid; gap:8px; }
    .nav button { height:44px; border:0; border-radius:7px; background:transparent; color:var(--muted); text-align:left; padding:0 12px; }
    .nav button.active { background:#1d3261; color:#fff; }
    .side-foot { position:absolute; bottom:18px; left:18px; color:var(--muted); font-size:13px; }
    .main { max-width:1400px; margin:0 auto; padding:18px 22px 28px; min-width:0; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:14px; }
    h1 { margin:0; font-size:24px; }
    .app-title { display:flex; align-items:center; gap:10px; }
    .app-logo { width:38px; height:38px; flex:0 0 auto; filter:drop-shadow(0 8px 18px rgba(91,140,255,.28)); }
    h2 { margin:0 0 10px; font-size:18px; }
    .search { position:relative; display:flex; gap:8px; align-items:center; }
    .search select,.search input { height:38px; border:1px solid var(--line); border-radius:7px; background:var(--field); color:var(--text); padding:0 10px; transition:background-color .24s ease,color .24s ease,border-color .24s ease; }
    .search input { width:320px; }
    .suggest { position:absolute; top:44px; left:0; right:0; z-index:5; display:grid; gap:6px; max-height:360px; overflow:auto; }
    .pick { display:flex; align-items:center; justify-content:space-between; gap:10px; border:1px solid var(--line); border-radius:7px; background:var(--panel); padding:9px 10px; box-shadow:0 10px 30px rgba(0,0,0,.18); }
    .pick strong,.mono { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; }
    .pick span,.muted { color:var(--muted); }
    .pick button,.small-btn { height:30px; border:1px solid var(--line); border-radius:6px; background:var(--panel2); color:var(--text); padding:0 10px; transition:background-color .24s ease,color .24s ease,border-color .24s ease; }
    .cards { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:12px; }
    .card,.panel { border:1px solid var(--line); border-radius:8px; background:var(--panel-bg); transition:background .24s ease,border-color .24s ease,color .24s ease; }
    .card { padding:16px; min-height:112px; overflow:hidden; display:flex; flex-direction:column; justify-content:center; }
    .card-title { color:var(--text); font-weight:800; font-size:16px; margin-bottom:8px; }
    .card-price { font-size:28px; line-height:1.1; font-weight:900; }
    .card-change { font-size:16px; margin-top:6px; }
    .focus-grid { margin-bottom:10px; }
    .bottom-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .panel { padding:12px 14px; margin-bottom:12px; overflow:hidden; }
    .panel-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    table { width:100%; border-collapse:collapse; }
    th,td { padding:8px 8px; border-bottom:1px solid color-mix(in srgb, var(--line) 55%, transparent); text-align:right; white-space:nowrap; transition:border-color .24s ease,color .24s ease; }
    th:first-child,td:first-child,th:nth-child(2),td:nth-child(2) { text-align:left; }
    th { color:var(--muted); font-size:12px; font-weight:700; }
    tbody tr { cursor:pointer; }
    tbody tr:hover { background:rgba(91,140,255,.10); }
    tbody tr.dragging { opacity:.45; }
    tbody tr.drag-over { outline:1px solid var(--blue); outline-offset:-1px; }
    .up { color:var(--red); } .down { color:var(--green); } .danger { color:var(--red); }
    .detail-layer { display:none; position:fixed; inset:0; z-index:20; padding:5vh 4vw; background:rgba(2,8,18,.68); backdrop-filter:blur(2px); }
    body.detail-open .detail-layer { display:grid; place-items:center; animation:fadeIn .18s ease both; }
    .detail { width:min(1180px,92vw); max-height:90vh; overflow:auto; transform-origin:center center; border:1px solid var(--line); border-radius:10px; background:var(--panel); box-shadow:0 28px 80px rgba(0,0,0,.35); }
    body.detail-open .detail canvas { height:430px; }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    .detail-head { padding:20px 18px 14px; border-bottom:1px solid var(--line); }
    .detail-title { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .detail-title strong { font-size:22px; }
    .price { font-size:32px; font-weight:800; margin-top:10px; }
    .tabs { display:flex; gap:8px; padding:12px 16px 0; }
    .tabs button { height:34px; border:1px solid var(--line); border-radius:6px; background:var(--field); color:var(--text); padding:0 14px; }
    .tabs button.active { background:#203d7c; border-color:#3157ad; color:#fff; }
    .chart-wrap { position:relative; padding:12px 16px 8px; }
    canvas { width:100%; height:310px; display:block; }
    .chart-tip { display:none; position:absolute; z-index:2; min-width:190px; padding:8px 10px; border:1px solid var(--line); border-radius:6px; background:rgba(10,20,36,.96); color:#eef4ff; box-shadow:0 12px 28px rgba(0,0,0,.35); font-size:12px; pointer-events:none; }
    .legend { display:flex; flex-wrap:wrap; gap:12px; color:var(--muted); font-size:13px; padding:0 16px 12px; }
    .dot { display:inline-block; width:10px; height:3px; vertical-align:middle; margin-right:4px; border-radius:2px; }
    .stats { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid var(--line); }
    .stat { padding:11px 16px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
    .stat span { display:block; color:var(--muted); font-size:12px; margin-bottom:4px; }
    .stat strong { font-size:15px; }
    .placeholder { padding:28px 18px; color:var(--muted); }
    @media (max-width:1100px) { .bottom-grid,.cards { grid-template-columns:1fr; } .search input { width:210px; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="side">
      <div class="brand"><div class="logo">↗</div><span>MarketView</span></div>
      <div class="nav"><button class="active">總覽</button><button>自選股</button><button>指數</button><button>期貨</button><button>搜尋</button><button>設定</button></div>
      <div class="side-foot">深色模式<br><span id="sideTime"></span></div>
    </aside>
    <main class="main">
      <div class="topbar"><div><div class="app-title"><svg class="app-logo" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mvLogo" x1="8" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse"><stop stop-color="#38e083"/><stop offset=".55" stop-color="#5b8cff"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><rect x="5" y="5" width="38" height="38" rx="11" fill="url(#mvLogo)"/><path d="M14 31.5 21.5 24l5.5 5.5L35 17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 17h5v5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><h1>盤勢駕駛艙</h1></div><div class="muted">刷新時間：<span id="refreshTime">-</span>，每 5 秒自動刷新</div></div><div class="search"><select id="market"><option value="tw">台股</option><option value="us">美股</option></select><input id="search" placeholder="輸入代號或名稱" autocomplete="off"><button class="small-btn" id="themeButton" type="button">白色主題</button><button class="small-btn" id="refreshButton" type="button">手動刷新</button><div id="suggest" class="suggest"></div></div></div>
      <div class="cards" id="cards"></div>
      <div class="focus-grid"><section class="panel" id="watchPanel"></section></div>
      <div class="bottom-grid"><section class="panel" id="indexPanel"></section><section class="panel" id="futurePanel"></section></div>
    </main>
    <div class="detail-layer" id="detailLayer"><section class="detail" id="detail"></section></div>
  </div>
  <script>
    const cardsEl = document.querySelector('#cards'), watchPanel = document.querySelector('#watchPanel'), indexPanel = document.querySelector('#indexPanel'), futurePanel = document.querySelector('#futurePanel'), detailLayer = document.querySelector('#detailLayer'), detailEl = document.querySelector('#detail'), suggestEl = document.querySelector('#suggest'), searchEl = document.querySelector('#search'), marketEl = document.querySelector('#market'), refreshButton = document.querySelector('#refreshButton'), themeButton = document.querySelector('#themeButton'), refreshTimeEl = document.querySelector('#refreshTime');
    let detailData=null, chartMode='k', kPeriod='d', chartState=null, latest=null, searchTimer=null;
    const fmtNumber=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:d}):'-';
    const fmtInt=v=>Number.isFinite(v)?Math.round(v).toLocaleString('zh-TW'):'-';
    const fmtTime=v=>v?new Date(v).toLocaleString('zh-TW',{hour12:false}):'-';
    const cls=v=>v>0?'up':v<0?'down':'';
    const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    function flatGroups(data){ return Object.fromEntries(data.groups.map(g=>[g.name,g.quotes])); }
    function setRefreshTime(){ const t=fmtTime(latest?.fetchedAt); document.querySelector('#sideTime').textContent=t; refreshTimeEl.textContent=t; }
    async function load(){ const res=await fetch('/api/quotes',{cache:'no-store'}); latest=await res.json(); setRefreshTime(); renderAll(); setTimeout(load,(latest.refreshSeconds||5)*1000); }
    function renderAll(){ const groups=flatGroups(latest), watch=groups['自選股']||[], index=groups['指數']||[], futures=groups['期貨']||[]; renderCards(index.slice(0,5)); renderWatch(watch); renderSimple(indexPanel,'指數',index); renderSimple(futurePanel,'期貨',futures); }
    function renderCards(rows){ cardsEl.innerHTML=rows.map(q=>'<div class="card" data-open="'+esc(q.symbol)+'" data-name="'+esc(q.name)+'" data-type="'+esc(q.type)+'"><div class="card-title">'+esc(q.name)+'</div><div class="card-price">'+fmtNumber(q.price,2)+'</div><div class="card-change '+cls(q.change)+'">'+fmtNumber(q.change,2)+' ('+fmtNumber(q.changePercent,2)+'%)</div></div>').join(''); }
    function renderWatch(rows){ watchPanel.innerHTML='<div class="panel-head"><h2>自選股</h2></div>'+table(['名稱','代號','現價','漲跌','漲跌幅','成交量','市場',''], rows.map(q=>[q.name,q.symbol,fmtNumber(q.price,2),num(q.change),pct(q.changePercent),fmtInt(q.volume),q.type, '<button class="small-btn danger" data-remove="'+esc(q.symbol)+'">刪除</button>',q]), true); }
    function renderSimple(el,title,rows){ el.innerHTML='<h2>'+title+'</h2>'+table(['名稱','代號','現價','漲跌','漲跌幅','市場'], rows.map(q=>[q.name,q.symbol,fmtNumber(q.price,2),num(q.change),pct(q.changePercent),q.type,q])); }
    async function refreshNow(){ latest = await (await fetch('/api/quotes',{cache:'no-store'})).json(); setRefreshTime(); renderAll(); }
    function table(headers, rows, draggable=false){ return '<table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>{ const q=r[r.length-1]; return '<tr '+(draggable?'draggable="true" data-watch-row ':'')+'data-open="'+esc(q.symbol)+'" data-name="'+esc(q.name)+'" data-type="'+esc(q.type)+'">'+r.slice(0,-1).map((c,i)=>'<td class="'+(String(c).includes('+')?'up':String(c).includes('-')?'down':'')+'">'+c+'</td>').join('')+'</tr>'; }).join('')+'</tbody></table>'; }
    function num(v){ return Number.isFinite(v)?(v>0?'+':'')+fmtNumber(v,2):'-'; } function pct(v){ return Number.isFinite(v)?(v>0?'+':'')+fmtNumber(v,2)+'%':'-'; } function money(v){ return Number.isFinite(v)?(v>0?'+':'')+fmtNumber(v,2):'-'; }
    async function search(){ const q=searchEl.value.trim(); if(!q){suggestEl.innerHTML='';return;} suggestEl.innerHTML='<div class="pick muted">搜尋中...</div>'; const res=await fetch('/api/search?market='+encodeURIComponent(marketEl.value)+'&q='+encodeURIComponent(q),{cache:'no-store'}); const items=await res.json(); suggestEl.innerHTML=items.map(x=>'<div class="pick" data-open="'+esc(x.symbol)+'" data-name="'+esc(x.name)+'" data-type="'+esc(x.type)+'"><div><strong>'+esc(x.symbol)+'</strong> <span>'+esc(x.type)+' '+esc(x.name)+'</span></div><button data-add="'+esc(x.symbol)+'" data-name="'+esc(x.name)+'" data-type="'+esc(x.type)+'">加入</button></div>').join('')||'<div class="pick muted">沒有結果</div>'; }
    async function post(url, body){ const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error('HTTP '+r.status); }
    async function openDetail(symbol,name,type,source){ const from=source?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,width:1,height:1}; document.body.classList.add('detail-open'); detailEl.innerHTML='<div class="placeholder">載入 '+esc(symbol)+'...</div>'; requestAnimationFrame(()=>animateDetail(from,detailEl.getBoundingClientRect())); const r=await fetch('/api/detail?symbol='+encodeURIComponent(symbol)+'&name='+encodeURIComponent(name||'')+'&type='+encodeURIComponent(type||''),{cache:'no-store'}); detailData=await r.json(); chartMode='k'; kPeriod='d'; renderDetail(); }
    function renderDetail(){ const q=detailData.quote,s=detailData.stats; const inWatch=(latest?.groups?.find(g=>g.name==='自選股')?.quotes||[]).some(x=>x.symbol===q.symbol); const watchBtn=inWatch?'<button class="small-btn danger" data-remove="'+esc(q.symbol)+'">取消自選</button>':'<button class="small-btn" data-add="'+esc(q.symbol)+'" data-name="'+esc(q.name)+'" data-type="'+esc(q.type)+'">加入自選</button>'; detailEl.innerHTML='<div class="detail-head"><div class="detail-title"><div><strong>'+esc(q.name)+'</strong> <span class="mono muted">'+esc(q.symbol)+'</span><div class="muted">'+esc(q.type)+' '+esc(q.market)+'</div></div><div>'+watchBtn+' <button class="small-btn" data-close-detail>關閉</button></div></div><div class="price">'+fmtNumber(q.price,2)+'</div><div class="'+cls(q.change)+'">'+num(q.change)+' ('+pct(q.changePercent)+')</div></div><div class="tabs"><button data-chart="k" data-period="d" class="'+(chartMode==='k'&&kPeriod==='d'?'active':'')+'">日 K</button><button data-chart="k" data-period="w" class="'+(chartMode==='k'&&kPeriod==='w'?'active':'')+'">週 K</button><button data-chart="k" data-period="m" class="'+(chartMode==='k'&&kPeriod==='m'?'active':'')+'">月 K</button><button data-chart="line" class="'+(chartMode==='line'?'active':'')+'">分時</button></div><div class="chart-wrap"><canvas id="chart"></canvas><div class="chart-tip" id="chartTip"></div></div><div class="legend">'+legend()+'</div><div class="stats">'+stat('開盤',fmtNumber(s.open,2))+stat('最高',fmtNumber(s.high,2))+stat('最低',fmtNumber(s.low,2))+stat('昨收',fmtNumber(s.previousClose,2))+stat('成交量',fmtInt(s.volume))+stat('20日均量',fmtInt(s.avgVolume20))+stat('一年高點',fmtNumber(s.high252||s.fiftyTwoWeekHigh,2))+stat('一年低點',fmtNumber(s.low252||s.fiftyTwoWeekLow,2))+'</div>'; drawChart(); }
    function stat(a,b){return '<div class="stat"><span>'+a+'</span><strong>'+b+'</strong></div>'} function legend(){return chartMode==='line'?'<span><i class="dot" style="background:#ff5b52"></i>平盤上方</span><span><i class="dot" style="background:#38e083"></i>平盤下方</span>':'<span><i class="dot" style="background:#a78bfa"></i>MA5</span><span><i class="dot" style="background:#f7b955"></i>MA10</span><span><i class="dot" style="background:#38e083"></i>MA20</span><span><i class="dot" style="background:#5b8cff"></i>MA60</span>'}
    function chartData(){ if(chartMode==='line') return detailData.intraday; const d=kPeriod==='d'?detailData.daily:aggregate(detailData.daily,kPeriod); return addMA(d).slice(-160); }
    function aggregate(rows,p){ const m=new Map(); rows.forEach(r=>{ const dt=new Date(r.time), key=p==='w'?dt.getFullYear()+'-W'+week(dt):dt.getFullYear()+'-'+dt.getMonth(); const v=m.get(key); if(!v)m.set(key,{...r,volume:r.volume||0}); else{v.high=Math.max(v.high,r.high);v.low=Math.min(v.low,r.low);v.close=r.close;v.volume+=r.volume||0;} }); return [...m.values()]; }
    function week(dt){ const d=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate())); d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7)); const s=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-s)/86400000)+1)/7); }
    function addMA(rows){ return rows.map((r,i)=>({...r,ma5:ma(rows,i,5),ma10:ma(rows,i,10),ma20:ma(rows,i,20),ma60:ma(rows,i,60)})); } function ma(rows,i,n){ if(i+1<n)return null; const a=rows.slice(i+1-n,i+1).map(x=>x.close); return a.reduce((s,x)=>s+x,0)/n; }
    function drawChart(){ const c=document.querySelector('#chart'); if(!c)return; const ctx=c.getContext('2d'), r=c.getBoundingClientRect(), d=window.devicePixelRatio||1; c.width=r.width*d;c.height=r.height*d;ctx.scale(d,d);ctx.clearRect(0,0,r.width,r.height);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--chart-bg').trim()||'#0b1627';ctx.fillRect(0,0,r.width,r.height); const pad={l:44,r:10,t:12,b:24}, data=chartData(); if(!data.length)return; const base=chartMode==='line'?detailData.stats.previousClose:null, vals=data.flatMap(x=>chartMode==='line'?[x.close,base]:[x.high,x.low,x.ma5,x.ma10,x.ma20,x.ma60]).filter(Number.isFinite), min=Math.min(...vals), max=Math.max(...vals), session=detailData.session||{}, timeX=chartMode==='line'&&Number.isFinite(session.start)&&Number.isFinite(session.end)&&session.end>session.start, x=i=>timeX?pad.l+(data[i].time-session.start)/(session.end-session.start)*(r.width-pad.l-pad.r):pad.l+i/Math.max(data.length-1,1)*(r.width-pad.l-pad.r), y=v=>pad.t+(max-v)/Math.max(max-min,.0001)*(r.height-pad.t-pad.b); chartState={data,x,y,pad,w:r.width,h:r.height}; grid(ctx,r.width,r.height,pad,min,max); chartMode==='line'?lineByBase(ctx,data,x,y,base,pad.l,r.width-pad.r):candles(ctx,data,x,y); if(chartMode==='k'){line(ctx,data,x,y,'ma5','#a78bfa',1.2);line(ctx,data,x,y,'ma10','#f7b955',1.2);line(ctx,data,x,y,'ma20','#38e083',1.2);line(ctx,data,x,y,'ma60','#5b8cff',1.2);} markExtremes(ctx,data,x,y); c.onmousemove=e=>tip(e); c.onmouseleave=()=>{const t=document.querySelector('#chartTip'); if(t)t.style.display='none'; drawChart();}; }
    function grid(ctx,w,h,p,min,max){ ctx.strokeStyle='rgba(255,255,255,.12)';ctx.fillStyle='#8fa3bd';ctx.font='12px system-ui'; for(let i=0;i<=4;i++){const yy=p.t+i/4*(h-p.t-p.b),v=max-i/4*(max-min);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(w-p.r,yy);ctx.stroke();ctx.fillText(fmtNumber(v,2),4,yy+4);} }
    function line(ctx,d,x,y,k,c,w){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();let on=false;d.forEach((r,i)=>{if(!Number.isFinite(r[k]))return;on?ctx.lineTo(x(i),y(r[k])):(ctx.moveTo(x(i),y(r[k])),on=true)});ctx.stroke();}
    function segment(ctx,x1,y1,x2,y2,color){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
    function lineByBase(ctx,d,x,y,base,left,right){ if(!Number.isFinite(base)){line(ctx,d,x,y,'close',getComputedStyle(document.body).getPropertyValue('--text').trim()||'#fff',2);return;} ctx.strokeStyle='#8fa3bd';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(left,y(base));ctx.lineTo(right,y(base));ctx.stroke();ctx.setLineDash([]); for(let i=1;i<d.length;i++){const a=d[i-1].close,b=d[i].close;if(!Number.isFinite(a)||!Number.isFinite(b))continue;const x1=x(i-1),y1=y(a),x2=x(i),y2=y(b);if((a-base)*(b-base)<0){const t=(base-a)/(b-a),xm=x1+(x2-x1)*t,ym=y(base);segment(ctx,x1,y1,xm,ym,a>=base?'#ff5b52':'#38e083');segment(ctx,xm,ym,x2,y2,b>=base?'#ff5b52':'#38e083');}else segment(ctx,x1,y1,x2,y2,a>=base||b>=base?'#ff5b52':'#38e083');} }
    function candles(ctx,d,x,y){const bw=Math.max(2,(x(1)-x(0))*.58);d.forEach((r,i)=>{if(![r.open,r.high,r.low,r.close].every(Number.isFinite))return;const up=r.close>=r.open,xx=x(i);ctx.strokeStyle=ctx.fillStyle=up?'#ff5b52':'#38e083';ctx.beginPath();ctx.moveTo(xx,y(r.high));ctx.lineTo(xx,y(r.low));ctx.stroke();ctx.fillRect(xx-bw/2,y(Math.max(r.open,r.close)),bw,Math.max(y(Math.min(r.open,r.close))-y(Math.max(r.open,r.close)),1));});}
    function markExtremes(ctx,d,x,y){ const hiKey=chartMode==='line'?'close':'high', loKey=chartMode==='line'?'close':'low', highs=d.map((r,i)=>({i,v:r[hiKey]})).filter(p=>Number.isFinite(p.v)), lows=d.map((r,i)=>({i,v:r[loKey]})).filter(p=>Number.isFinite(p.v)); if(!highs.length||!lows.length)return; const hi=highs.reduce((a,b)=>b.v>a.v?b:a), lo=lows.reduce((a,b)=>b.v<a.v?b:a); labelPrice(ctx,x(hi.i),y(hi.v),hi.v,true); labelPrice(ctx,x(lo.i),y(lo.v),lo.v,false); }
    function labelPrice(ctx,px,py,value,isHigh){ const text=fmtNumber(value,2); ctx.save(); ctx.font='12px system-ui'; const right=px<chartState.w-105, tx=right?px+8:px-8-ctx.measureText(text).width, lineEnd=right?px+26:px-26; ctx.strokeStyle=isHigh?'#ff5b52':'#38e083'; ctx.fillStyle=ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(lineEnd,py); ctx.stroke(); ctx.fillText(text,tx,Math.max(12,Math.min(chartState.h-8,py+(isHigh?-6:14)))); ctx.restore(); }
    function tip(e){ const c=e.currentTarget,r=c.getBoundingClientRect(),mouseX=e.clientX-r.left,i=chartState.data.reduce((best,_,idx)=>Math.abs(chartState.x(idx)-mouseX)<Math.abs(chartState.x(best)-mouseX)?idx:best,0),row=chartState.data[i],t=document.querySelector('#chartTip'); drawChart(); const ctx=c.getContext('2d'); ctx.strokeStyle='#8fa3bd';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(chartState.x(i),chartState.pad.t);ctx.lineTo(chartState.x(i),chartState.h-chartState.pad.b);ctx.stroke();ctx.setLineDash([]); t.style.display='block';t.style.left=Math.min(Math.max(e.clientX-r.left+12,8),r.width-220)+'px';t.style.top=Math.max(e.clientY-r.top-18,8)+'px';t.innerHTML=chartMode==='line'?'<b>'+fmtTime(row.time)+'</b><br>價格：'+fmtNumber(row.close,4)+'<br>量：'+fmtInt(row.volume):'<b>'+new Date(row.time).toLocaleDateString('zh-TW')+'</b><br>開：'+fmtNumber(row.open,2)+' 高：'+fmtNumber(row.high,2)+'<br>低：'+fmtNumber(row.low,2)+' 收：'+fmtNumber(row.close,2)+'<br>MA5：'+fmtNumber(row.ma5,2)+' MA20：'+fmtNumber(row.ma20,2); }
    function animateDetail(from, to) {
      const dx = from.left - to.left, dy = from.top - to.top;
      const sx = from.width / Math.max(to.width, 1), sy = from.height / Math.max(to.height, 1);
      detailEl.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', opacity: .92 },
        { transform: 'translate(0,0) scale(1,1)', opacity: 1 }
      ], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    function closeDetail(){ if(!document.body.classList.contains('detail-open'))return; detailEl.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.96)'}],{duration:140,easing:'ease-out'}).finished.finally(()=>{document.body.classList.remove('detail-open'); detailData=null; detailEl.innerHTML='';}); }
    function setTheme(theme){ document.body.classList.toggle('light',theme==='light'); themeButton.textContent=theme==='light'?'暗色主題':'白色主題'; localStorage.setItem('theme',theme); }
    function animateRows(tbody, before){ [...tbody.children].forEach(row=>{ const old=before.get(row), now=row.getBoundingClientRect(); if(!old)return; const dy=old.top-now.top; if(dy) row.animate([{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:150,easing:'ease-out'}); }); }
    async function saveWatchOrder(){ const symbols=[...watchPanel.querySelectorAll('[data-watch-row]')].map(row=>row.dataset.open); await post('/api/watchlist/reorder',{symbols}); await load(); }
    watchPanel.addEventListener('dragstart',e=>{ const row=e.target.closest('[data-watch-row]'); if(!row)return; row.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',row.dataset.open); });
    watchPanel.addEventListener('dragover',e=>{ const row=e.target.closest('[data-watch-row]'), dragging=watchPanel.querySelector('.dragging'); if(!row||!dragging||row===dragging)return; e.preventDefault(); row.classList.add('drag-over'); const tbody=row.parentNode, before=new Map([...tbody.children].map(x=>[x,x.getBoundingClientRect()])), after=e.clientY>row.getBoundingClientRect().top+row.offsetHeight/2; tbody.insertBefore(dragging, after?row.nextSibling:row); animateRows(tbody,before); });
    watchPanel.addEventListener('dragleave',e=>e.target.closest('[data-watch-row]')?.classList.remove('drag-over'));
    watchPanel.addEventListener('dragend',async e=>{ const row=e.target.closest('[data-watch-row]'); if(!row)return; row.classList.remove('dragging'); watchPanel.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over')); await saveWatchOrder(); });
    document.body.addEventListener('click',async e=>{ const add=e.target.closest('[data-add]'); if(add){e.stopPropagation(); await post('/api/watchlist/add',{symbol:add.dataset.add,name:add.dataset.name,type:add.dataset.type}); suggestEl.innerHTML=''; searchEl.value=''; await load(); if(detailData)renderDetail(); return;} const rem=e.target.closest('[data-remove]'); if(rem){e.stopPropagation(); await post('/api/watchlist/remove',{symbol:rem.dataset.remove}); await load(); if(detailData)renderDetail(); return;} if(e.target===detailLayer){closeDetail();return;} const close=e.target.closest('[data-close-detail]'); if(close){closeDetail();return;} const tab=e.target.closest('[data-chart]'); if(tab){chartMode=tab.dataset.chart;if(tab.dataset.period)kPeriod=tab.dataset.period;renderDetail();return;} const open=e.target.closest('[data-open]'); if(open)openDetail(open.dataset.open,open.dataset.name,open.dataset.type,open); });
    refreshButton.addEventListener('click', refreshNow); themeButton.addEventListener('click',()=>setTheme(document.body.classList.contains('light')?'dark':'light')); searchEl.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,250);}); marketEl.addEventListener('change',search); window.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();}); window.addEventListener('resize',()=>{if(detailData)drawChart();}); setTheme(localStorage.getItem('theme')||'dark'); load();
  </script>
</body>
</html>`;

async function selfTest() {
  const data = await quotesResponse();
  const failed = data.groups.flatMap(group => group.quotes.filter(q => !q.ok).map(q => `${group.name}/${q.symbol}: ${q.error}`));
  if (failed.length) throw new Error(failed.join("; "));
  const search = await yahooSearch("us", "QQ");
  if (!search.some(x => x.symbol === "QQQ")) throw new Error("search failed");
  const twSearchResults = await yahooSearch("tw", "00");
  if (!twSearchResults.some(x => x.symbol === "0050.TW") || !twSearchResults.some(x => x.symbol === "0052.TW")) throw new Error("tw search failed");
  const tpexSearchResults = await yahooSearch("tw", "7723");
  if (!tpexSearchResults.some(x => x.symbol === "7723.TWO" && x.name === "築間")) throw new Error("tpex search failed");
  const detail = await detailResponse("0050.TW", "元大台灣50", "台股");
  if (!detail.daily.length || !detail.intraday.length) throw new Error("detail failed");
  console.log(`ok: ${data.groups.reduce((sum, group) => sum + group.quotes.length, 0)} quotes, detail ${detail.daily.length} days`);
}

if (process.argv.includes("--self-test")) {
  selfTest().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  return;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, page, "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/api/config") return json(res, 200, await readConfig());
    if (req.method === "GET" && url.pathname === "/api/quotes") return json(res, 200, await quotesResponse());
    if (req.method === "GET" && url.pathname === "/api/search") return json(res, 200, await yahooSearch(url.searchParams.get("market"), url.searchParams.get("q")));
    if (req.method === "GET" && url.pathname === "/api/detail") return json(res, 200, await detailResponse(url.searchParams.get("symbol"), url.searchParams.get("name"), url.searchParams.get("type")));
    if (req.method === "POST" && url.pathname === "/api/watchlist/add") return json(res, 200, await addWatchSymbol(req));
    if (req.method === "POST" && url.pathname === "/api/watchlist/remove") return json(res, 200, await removeWatchSymbol(req));
    if (req.method === "POST" && url.pathname === "/api/watchlist/reorder") return json(res, 200, await reorderWatchSymbols(req));
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Stock dashboard: http://localhost:${PORT}`);
  twUniverse().catch(() => {});
});
