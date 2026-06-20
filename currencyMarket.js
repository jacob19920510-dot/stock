const CURRENCY_CODES = ["USD", "TWD", "CNY", "JPY", "ZAR", "EUR"];
const DEFAULT_CURRENCY_FAVORITES = ["USD", "CNY", "JPY", "ZAR", "EUR"];
const DEFAULT_CURRENCY_FROM = "USD";
const DEFAULT_CURRENCY_TO = "TWD";
const MAX_CURRENCY_FAVORITES = 5;

const CURRENCY_OPTIONS = [
  { code: "USD", symbol: "USDTWD=X", name: "\u7f8e\u5143", label: "USD \u7f8e\u5143" },
  { code: "TWD", symbol: "", name: "\u65b0\u53f0\u5e63", label: "TWD \u65b0\u53f0\u5e63", synthetic: true },
  { code: "CNY", symbol: "CNYTWD=X", name: "\u4eba\u6c11\u5e63", label: "CNY \u4eba\u6c11\u5e63" },
  { code: "JPY", symbol: "JPYTWD=X", name: "\u65e5\u5713", label: "JPY \u65e5\u5713" },
  { code: "ZAR", symbol: "ZARTWD=X", name: "\u5357\u975e\u5e63", label: "ZAR \u5357\u975e\u5e63" },
  { code: "EUR", symbol: "EURTWD=X", name: "\u6b50\u5143", label: "EUR \u6b50\u5143" },
];

const CURRENCY_OPTION_MAP = new Map(CURRENCY_OPTIONS.map(option => [option.code, option]));

function normalizeCurrencyCode(value, fallback = "TWD") {
  const code = String(value || "").trim().toUpperCase();
  return CURRENCY_OPTION_MAP.has(code) ? code : fallback;
}

function normalizeCurrencyFavorites(favorites) {
  const seen = new Set();
  const picked = (Array.isArray(favorites) ? favorites : [])
    .map(value => normalizeCurrencyCode(value, ""))
    .filter(code => code && code !== "TWD" && !seen.has(code) && seen.add(code))
    .slice(0, MAX_CURRENCY_FAVORITES);
  for (const code of DEFAULT_CURRENCY_FAVORITES) {
    if (picked.length >= MAX_CURRENCY_FAVORITES) break;
    if (seen.has(code)) continue;
    picked.push(code);
    seen.add(code);
  }
  return picked;
}

function normalizeCurrencyConfig(currency) {
  const raw = currency && typeof currency === "object" ? currency : {};
  const favorites = normalizeCurrencyFavorites(raw.favorites);
  const from = normalizeCurrencyCode(raw.from, DEFAULT_CURRENCY_FROM);
  const fallbackTo = from === DEFAULT_CURRENCY_TO ? "USD" : DEFAULT_CURRENCY_TO;
  const to = normalizeCurrencyCode(raw.to, fallbackTo);
  return {
    favorites,
    from,
    to: from === to ? fallbackTo : to,
  };
}

function cloneCurrencyOptions() {
  return CURRENCY_OPTIONS.map(option => ({ ...option }));
}

module.exports = {
  CURRENCY_CODES,
  CURRENCY_OPTIONS,
  CURRENCY_OPTION_MAP,
  DEFAULT_CURRENCY_FAVORITES,
  DEFAULT_CURRENCY_FROM,
  DEFAULT_CURRENCY_TO,
  MAX_CURRENCY_FAVORITES,
  cloneCurrencyOptions,
  normalizeCurrencyCode,
  normalizeCurrencyConfig,
  normalizeCurrencyFavorites,
};
