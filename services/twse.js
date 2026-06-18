const twNameCache = new Map();
let twUniverseCache = null;
let twSharesCache = null;

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().slice(0, 24);
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

async function twSharesOutstanding() {
  if (twSharesCache && Date.now() - twSharesCache.time < 86400000) return twSharesCache.items;
  const [listed, tpex] = await Promise.all([
    fetch("https://openapi.twse.com.tw/v1/opendata/t187ap03_L", { headers: { "user-agent": "stock-dashboard/1.0" } }).then(r => r.ok ? r.json() : []),
    fetch("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O", { headers: { "user-agent": "stock-dashboard/1.0" } }).then(r => r.ok ? r.json() : []),
  ]);
  const items = new Map();
  for (const item of Array.isArray(listed) ? listed : []) {
    const code = String(item["公司代號"] || "").trim().toUpperCase();
    const shares = numberOrNull(item["已發行普通股數或TDR原股發行股數"]);
    if (/^[0-9A-Z]{4,6}$/.test(code) && Number.isFinite(shares) && shares > 0) items.set(`${code}.TW`, shares);
  }
  for (const item of Array.isArray(tpex) ? tpex : []) {
    const code = String(item.SecuritiesCompanyCode || "").trim().toUpperCase();
    const shares = numberOrNull(item.IssueShares);
    if (/^[0-9A-Z]{4,6}$/.test(code) && Number.isFinite(shares) && shares > 0) items.set(`${code}.TWO`, shares);
  }
  twSharesCache = { time: Date.now(), items };
  return items;
}

function numberOrNull(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  hasChinese,
  twseCodeQuery,
  twName,
  twUniverse,
  twSharesOutstanding,
};
