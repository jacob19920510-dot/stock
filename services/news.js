const CACHE_TTL_MS = 10 * 60 * 1000;
const FEED_TIMEOUT_MS = 8000;
const IMAGE_TIMEOUT_MS = 4000;
const MAX_ARTICLES = 36;

const cache = new Map();
const imageCache = new Map();

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

function articleId(url, title) {
  const base = `${url || ""}:${title || ""}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

async function fetchText(url) {
  return fetchTextWithTimeout(url, FEED_TIMEOUT_MS);
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
  const chunkSize = 8;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const images = await Promise.all(chunk.map(article => article.image ? Promise.resolve(article.image) : fetchArticleImage(article.url)));
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

function uniqueArticles(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = (row.url || row.title).replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, MAX_ARTICLES);
}

async function newsResponse(category) {
  const key = normalizeCategory(category);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.value;

  const feeds = FEEDS[key];
  const settled = await Promise.allSettled(feeds.map(fetchFeed));
  const articles = await enrichArticleImages(uniqueArticles(settled.flatMap(result => result.status === "fulfilled" ? result.value : [])));
  const warnings = settled
    .map((result, index) => result.status === "rejected" ? `${feeds[index].name}: ${result.reason?.message || "fetch failed"}` : "")
    .filter(Boolean);

  const value = articles.length ? {
    ok: true,
    category: key,
    label: CATEGORY_LABELS[key],
    fetchedAt: new Date().toISOString(),
    sources: feeds.map(feed => ({ name: feed.name, url: feed.url, language: feed.language })),
    articles,
    ...(warnings.length ? { warnings } : {}),
  } : {
    ok: false,
    category: key,
    label: CATEGORY_LABELS[key],
    fetchedAt: new Date().toISOString(),
    sources: feeds.map(feed => ({ name: feed.name, url: feed.url, language: feed.language })),
    articles: [],
    error: warnings.join("; ") || "no articles",
  };

  cache.set(key, { time: Date.now(), value });
  return value;
}

module.exports = { newsResponse };
