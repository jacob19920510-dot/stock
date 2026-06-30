const fs = require("node:fs");
const path = require("node:path");

const CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_TIMEOUT_MS = 5000;
const IMAGE_TIMEOUT_MS = 1200;
const API_TIMEOUT_MS = 8000;
const MAX_ARTICLES = 24;
const MAX_ENRICHED_IMAGES = 8;
const MARKETAUX_API_KEY = readMarketauxApiKey();

const cache = new Map();
const imageCache = new Map();

function readMarketauxApiKey() {
  if (process.env.MARKETAUX_API_KEY) return process.env.MARKETAUX_API_KEY;
  try {
    const secretsPath = path.join(__dirname, "..", "secrets.json");
    const secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    return String(secrets.marketauxApiKey || "").trim();
  } catch {
    return "";
  }
}

const CATEGORY_LABELS = {
  all: "全部",
  tw: "台股",
  us: "美股",
  global: "全球市場",
  tech: "科技產業",
  crypto: "加密貨幣",
  headline: "財經要聞",
};

const GOOGLE_BASE = "https://news.google.com/rss/search";

function googleFeed(query) {
  const params = new URLSearchParams({
    q: `${query} when:7d`,
    hl: "zh-TW",
    gl: "TW",
    ceid: "TW:zh-Hant",
  });
  return `${GOOGLE_BASE}?${params.toString()}`;
}

const FEEDS = {
  all: [
    { name: "Google 新聞", category: "headline", language: "zh-Hant", url: googleFeed("財經 OR 金融 OR 股市 OR 經濟") },
    { name: "MarketWatch", category: "headline", language: "en", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  ],
  tw: [
    { name: "Google 新聞", category: "tw", language: "zh-Hant", url: googleFeed("台股 OR 臺股 OR 加權指數 OR 櫃買") },
  ],
  us: [
    { name: "Google 新聞", category: "us", language: "zh-Hant", url: googleFeed("美股 OR 那斯達克 OR 標普500 OR 道瓊") },
    { name: "MarketWatch", category: "us", language: "en", url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse" },
  ],
  global: [
    { name: "Google 新聞", category: "global", language: "zh-Hant", url: googleFeed("全球市場 OR 國際股市 OR 外匯 OR 債券") },
    { name: "MarketWatch", category: "global", language: "en", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  ],
  tech: [
    { name: "Google 新聞", category: "tech", language: "zh-Hant", url: googleFeed("科技股 OR 半導體 OR AI OR 台積電 OR NVIDIA") },
  ],
  crypto: [
    { name: "Google 新聞", category: "crypto", language: "zh-Hant", url: googleFeed("加密貨幣 OR 比特幣 OR 以太幣 OR Bitcoin") },
  ],
  headline: [
    { name: "Google 新聞", category: "headline", language: "zh-Hant", url: googleFeed("財經要聞 OR 經濟新聞 OR 金融市場") },
    { name: "MarketWatch", category: "headline", language: "en", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  ],
};

const MARKETAUX_QUERIES = {
  all: { search: "stock market OR economy OR finance", language: "en", countries: "us" },
  tw: { search: "Taiwan Semiconductor OR TSMC OR Taiwan stocks", language: "en", countries: "tw,us" },
  us: { search: "US stocks OR Nasdaq OR S&P 500 OR earnings", language: "en", countries: "us" },
  global: { search: "global markets OR forex OR bonds OR commodities", language: "en", countries: "us,gb,ca,au" },
  tech: { search: "semiconductor OR AI stocks OR Nvidia OR TSMC", language: "en", countries: "us,tw" },
  crypto: { search: "bitcoin OR ethereum OR crypto market", language: "en", countries: "us" },
  headline: { search: "finance OR markets OR economy", language: "en", countries: "us" },
};

function normalizeCategory(category) {
  const key = String(category || "all").trim().toLowerCase();
  return FEEDS[key] ? key : "all";
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(value) {
  return decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function tagAttr(xml, tag, attr) {
  const match = xml.match(new RegExp(`<${tag}\\b([^>]*)>`, "i"));
  if (!match) return "";
  const attrMatch = match[1].match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
  return attrMatch ? decodeEntities(attrMatch[1]) : "";
}

function sourceLogo(url) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  } catch {
    return "";
  }
}

function sourceOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function articleId(url, title) {
  const base = `${url || ""}:${title || ""}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

async function fetchText(url) {
  return fetchTextWithTimeout(url, FEED_TIMEOUT_MS);
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) stock-dashboard/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) stock-dashboard/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function metaContent(html, names) {
  for (const name of names) {
    const pattern = new RegExp(`<meta\\b(?=[^>]*(?:property|name)=["']${name}["'])[^>]*content=["']([^"']+)["'][^>]*>`, "i");
    const reversePattern = new RegExp(`<meta\\b(?=[^>]*content=["']([^"']+)["'])[^>]*(?:property|name)=["']${name}["'][^>]*>`, "i");
    const match = html.match(pattern) || html.match(reversePattern);
    if (match) return decodeEntities(match[1]);
  }
  return "";
}

function absolutizeUrl(value, pageUrl) {
  if (!value) return "";
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return "";
  }
}

async function fetchArticleImage(url) {
  if (!url) return "";
  const cached = imageCache.get(url);
  if (cached !== undefined) return cached;
  try {
    const html = await fetchTextWithTimeout(url, IMAGE_TIMEOUT_MS);
    const title = metaContent(html, ["og:title"]);
    const rawImage = metaContent(html, ["og:image", "twitter:image", "twitter:image:src"]);
    const image = title === "Google News" ? "" : absolutizeUrl(rawImage, url);
    imageCache.set(url, image);
    return image;
  } catch {
    imageCache.set(url, "");
    return "";
  }
}

async function enrichArticleImages(articles) {
  const rows = articles.slice();
  let enrichedCount = rows.filter(article => article.image).length;
  const chunkSize = 8;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const images = await Promise.all(chunk.map(article => {
      if (article.image) return Promise.resolve(article.image);
      if (enrichedCount >= MAX_ENRICHED_IMAGES) return Promise.resolve("");
      enrichedCount += 1;
      return fetchArticleImage(article.url);
    }));
    images.forEach((image, offset) => {
      if (image) {
        rows[index + offset].image = image;
        rows[index + offset].imageKind = "article";
      } else if (rows[index + offset].sourceUrl) {
        rows[index + offset].image = sourceLogo(rows[index + offset].sourceUrl);
        rows[index + offset].imageKind = "source";
      }
    });
  }
  return rows;
}

function parseFeed(xml, feed) {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return itemMatches.map(item => {
    const rawTitle = tagValue(item, "title");
    const url = tagValue(item, "link");
    const source = tagValue(item, "source") || feed.name;
    const sourceUrl = tagAttr(item, "source", "url");
    const publishedAt = Date.parse(tagValue(item, "pubDate") || tagValue(item, "dc:date")) || Date.now();
    const image = tagAttr(item, "media:content", "url") || tagAttr(item, "media:thumbnail", "url") || tagAttr(item, "enclosure", "url");
    return {
      id: articleId(url, rawTitle),
      title: rawTitle.replace(/\s+-\s+[^-]+$/u, "").trim() || rawTitle,
      summary: stripTags(tagValue(item, "description")).slice(0, 220),
      url,
      source,
      sourceUrl,
      category: feed.category,
      publishedAt: new Date(publishedAt).toISOString(),
      image,
      imageKind: image ? "article" : "",
      language: feed.language,
    };
  }).filter(article => article.title && article.url);
}

async function fetchFeed(feed) {
  const xml = await fetchText(feed.url);
  return parseFeed(xml, feed);
}

function marketauxNewsUrl(category) {
  const query = MARKETAUX_QUERIES[category] || MARKETAUX_QUERIES.all;
  const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const params = new URLSearchParams({
    api_token: MARKETAUX_API_KEY,
    filter_entities: "true",
    limit: "3",
    published_after: publishedAfter,
    search: query.search,
    language: query.language,
    countries: query.countries,
  });
  return `https://api.marketaux.com/v1/news/all?${params.toString()}`;
}

function marketauxSourceName(source) {
  if (!source) return "Marketaux";
  if (typeof source === "string") return source;
  return String(source.name || source.domain || "Marketaux").trim() || "Marketaux";
}

function parseMarketauxNews(payload, category) {
  return (Array.isArray(payload?.data) ? payload.data : []).map(row => {
    const url = String(row.url || "").trim();
    const title = String(row.title || "").trim();
    const image = String(row.image_url || "").trim();
    return {
      id: articleId(url, title || row.uuid),
      title,
      summary: String(row.description || row.snippet || "").trim().slice(0, 220),
      url,
      source: marketauxSourceName(row.source),
      sourceUrl: sourceOrigin(url),
      category,
      publishedAt: new Date(Date.parse(row.published_at) || Date.now()).toISOString(),
      image,
      imageKind: image ? "article" : "",
      language: String(row.language || "").trim() || (category === "tw" ? "zh" : "en"),
      provider: "marketaux",
    };
  }).filter(article => article.title && article.url);
}

async function fetchMarketauxNews(category) {
  if (!MARKETAUX_API_KEY) return [];
  return parseMarketauxNews(await fetchJsonWithTimeout(marketauxNewsUrl(category), API_TIMEOUT_MS), category);
}

function hasMarketauxNews() {
  return Boolean(MARKETAUX_API_KEY);
}

function uniqueArticles(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = (row.url || row.title).replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  const imageBonusMs = 24 * 60 * 60 * 1000;
  const marketauxBonusMs = 60 * 24 * 60 * 60 * 1000;
  const rank = article => (Date.parse(article.publishedAt) || 0) + (article.image ? imageBonusMs : 0) + (article.provider === "marketaux" ? marketauxBonusMs : 0);
  return result.sort((a, b) => rank(b) - rank(a)).slice(0, MAX_ARTICLES);
}

async function newsResponse(category) {
  const key = normalizeCategory(category);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.value;

  const feeds = FEEDS[key];
  const sources = [
    ...(hasMarketauxNews() ? [{ name: "Marketaux", url: "https://www.marketaux.com/", language: MARKETAUX_QUERIES[key]?.language || "en" }] : []),
    ...feeds.map(feed => ({ name: feed.name, url: feed.url, language: feed.language })),
  ];
  const tasks = [
    ...(hasMarketauxNews() ? [fetchMarketauxNews(key)] : []),
    ...feeds.map(fetchFeed),
  ];
  const settled = await Promise.allSettled(tasks);
  const articles = await enrichArticleImages(uniqueArticles(settled.flatMap(result => result.status === "fulfilled" ? result.value : [])));
  const warnings = settled
    .map((result, index) => result.status === "rejected" ? `${sources[index]?.name || "News source"}: ${result.reason?.message || "fetch failed"}` : "")
    .filter(Boolean);

  const value = articles.length ? {
    ok: true,
    category: key,
    label: CATEGORY_LABELS[key],
    fetchedAt: new Date().toISOString(),
    sources,
    articles,
    ...(warnings.length ? { warnings } : {}),
  } : {
    ok: false,
    category: key,
    label: CATEGORY_LABELS[key],
    fetchedAt: new Date().toISOString(),
    sources,
    articles: [],
    error: warnings.join("; ") || "no articles",
  };

  cache.set(key, { time: Date.now(), value });
  return value;
}

module.exports = { newsResponse };
