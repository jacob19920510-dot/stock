const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const { readConfig, readWatchlists, createWatchlist, updateWatchlist, deleteWatchlist, addWatchSymbol, removeWatchSymbol, reorderWatchSymbols, reorderWatchlists, readGlobalMarket, updateGlobalMarket } = require("./config");
const { quotesResponse, rankingResponse, yahooSearch, detailResponse, globalMarketOptionsResponse } = require("./services/yahoo");
const { twUniverse } = require("./services/twse");

const PORT = Number(process.env.PORT || 8000);
const PUBLIC_DIR = path.join(__dirname, "public");

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8");
}

async function serveStatic(res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const fullPath = path.resolve(PUBLIC_DIR, file);
  if (!fullPath.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, "Not found", "text/plain; charset=utf-8");

  const ext = path.extname(fullPath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
  };
  if (!types[ext]) return send(res, 404, "Not found", "text/plain; charset=utf-8");

  try {
    return send(res, 200, await fs.readFile(fullPath), types[ext]);
  } catch (error) {
    if (error.code === "ENOENT") return send(res, 404, "Not found", "text/plain; charset=utf-8");
    throw error;
  }
}

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
    if (req.method === "GET" && url.pathname === "/api/config") return json(res, 200, await readConfig());
    if (req.method === "GET" && url.pathname === "/api/global-market") return json(res, 200, await readGlobalMarket());
    if (req.method === "GET" && url.pathname === "/api/global-market/options") return json(res, 200, await globalMarketOptionsResponse());
    if (req.method === "GET" && url.pathname === "/api/quotes") return json(res, 200, await quotesResponse());
    if (req.method === "GET" && url.pathname === "/api/rankings") return json(res, 200, await rankingResponse());
    if (req.method === "GET" && url.pathname === "/api/search") return json(res, 200, await yahooSearch(url.searchParams.get("market"), url.searchParams.get("q")));
    if (req.method === "GET" && url.pathname === "/api/detail") return json(res, 200, await detailResponse(url.searchParams.get("symbol"), url.searchParams.get("name"), url.searchParams.get("type")));
    if (req.method === "GET" && url.pathname === "/api/watchlists") return json(res, 200, await readWatchlists());
    if (req.method === "POST" && url.pathname === "/api/watchlists") return json(res, 200, await createWatchlist(req));
    if (req.method === "POST" && url.pathname === "/api/watchlists/reorder") return json(res, 200, await reorderWatchlists(req));
    const watchlistMatch = url.pathname.match(/^\/api\/watchlists\/([^/]+)(?:\/(add|remove|reorder))?$/);
    if (watchlistMatch) {
      const id = decodeURIComponent(watchlistMatch[1]);
      const action = watchlistMatch[2] || "";
      if (req.method === "PATCH" && !action) return json(res, 200, await updateWatchlist(req, id));
      if (req.method === "DELETE" && !action) return json(res, 200, await deleteWatchlist(id));
      if (req.method === "POST" && action === "add") return json(res, 200, await addWatchSymbol(req, id));
      if (req.method === "POST" && action === "remove") return json(res, 200, await removeWatchSymbol(req, id));
      if (req.method === "POST" && action === "reorder") return json(res, 200, await reorderWatchSymbols(req, id));
    }
    if (req.method === "POST" && url.pathname === "/api/global-market") return json(res, 200, await updateGlobalMarket(req));
    if (req.method === "POST" && url.pathname === "/api/watchlist/add") return json(res, 200, await addWatchSymbol(req));
    if (req.method === "POST" && url.pathname === "/api/watchlist/remove") return json(res, 200, await removeWatchSymbol(req));
    if (req.method === "POST" && url.pathname === "/api/watchlist/reorder") return json(res, 200, await reorderWatchSymbols(req));
    if (req.method === "GET") return serveStatic(res, url.pathname);
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Stock dashboard: http://localhost:${PORT}`);
  twUniverse().catch(() => {});
});
