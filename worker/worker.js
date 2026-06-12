import { LANDING_HTML } from "./landing.js";

// CONFIG — edit these to change the rotating links
const LINKS = [
  { name: "Vaibhav Aggarwal", text: "Vaibhav Aggarwal - connect on LinkedIn", link: "https://www.linkedin.com/in/vaibhav-aggarwal-15070a138/" },
  { name: "TopBid", text: "TopBid - sell the idle line in your terminal", link: "https://topbid.bankingvaibhav.workers.dev" },
  { name: "TopBid GitHub", text: "TopBid is open source - inspect the renderer", link: "https://github.com/Alakazam03/topbid" },
  { name: "Claude Code docs", text: "Claude Code statusLine docs - build on the hook", link: "https://docs.anthropic.com/en/docs/claude-code/statusline" },
  { name: "Claude Code hooks", text: "Claude Code hooks - automate your dev loop", link: "https://docs.anthropic.com/en/docs/claude-code/hooks" },
  { name: "Model Context Protocol", text: "MCP - connect AI tools to real context", link: "https://modelcontextprotocol.io/" },
  { name: "Cloudflare Workers", text: "Cloudflare Workers - ship edge apps fast", link: "https://workers.cloudflare.com/" },
  { name: "Karnal Biofuels", text: "Karnal Biofuels - clean energy from agri waste", link: "https://karnalbiofuels.in/" },
  { name: "Stately", text: "Stately - buy estamp anytime", link: "https://stately-frontend-staging.takemetoprod.com/" },
  { name: "Add your link", text: "Your link can show up in this terminal line", link: "https://topbid.bankingvaibhav.workers.dev/#featured" }
];

const PLEDGES_KEY = "pledges:v1";
const STARTER_MS = 60 * 1000;
const MAX_PLEDGES = 100;

// Counters live in KV (binding TOPBID) so points + views survive restarts and
// cold starts. If the binding is missing (local dev before `wrangler kv ...`),
// we fall back to in-memory maps so nothing breaks — they just reset.
const memImpressions = new Map();
const memViews = new Map();
let memPledges = [];

const kv = (env) => (env && env.TOPBID) || null;

async function getCount(env, key, mem) {
  const store = kv(env);
  if (!store) return mem.get(key) ?? 0;
  const v = await store.get(key);
  return v ? (parseInt(v, 10) || 0) : 0;
}

// KV has no atomic increment, so this read-modify-write can lose updates under
// heavy concurrency. Fine for a low-traffic link board; revisit with Durable
// Objects if accurate high-volume counting is ever needed.
async function incrCount(env, key, mem) {
  const store = kv(env);
  if (!store) {
    mem.set(key, (mem.get(key) ?? 0) + 1);
    return;
  }
  const cur = await getCount(env, key, mem);
  await store.put(key, String(cur + 1));
}

async function getFirstSeen(env, key) {
  const now = Date.now();
  const memKey = "first:" + key;
  const store = kv(env);
  if (!store) {
    if (!memImpressions.has(memKey)) memImpressions.set(memKey, now);
    return memImpressions.get(memKey);
  }
  const existing = await store.get(memKey);
  if (existing) return parseInt(existing, 10) || now;
  await store.put(memKey, String(now), { expirationTtl: 60 * 60 * 24 * 30 });
  return now;
}

async function getPledges(env) {
  const store = kv(env);
  if (!store) return memPledges;
  const raw = await store.get(PLEDGES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function savePledges(env, pledges) {
  const sorted = pledges
    .slice()
    .sort((a, b) => (b.pledge || 0) - (a.pledge || 0) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, MAX_PLEDGES);
  const store = kv(env);
  if (!store) {
    memPledges = sorted;
    return sorted;
  }
  await store.put(PLEDGES_KEY, JSON.stringify(sorted));
  return sorted;
}

function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanUrl(value) {
  const raw = String(value || "").trim();
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("URL must start with http or https");
  return url.toString();
}

function pledgeToLink(p) {
  return {
    name: p.name,
    text: p.text,
    link: p.link,
    pledge: p.pledge,
    pledged: true,
  };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });

const html = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...CORS },
  });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (path === "/" || path === "/index.html") {
      return html(LANDING_HTML);
    }

    if (path === "/ad") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      const firstSeen = await getFirstSeen(env, key);
      const pledges = await getPledges(env);
      const pledgeLinks = pledges.map(pledgeToLink);
      const pool = Date.now() - firstSeen >= STARTER_MS ? pledgeLinks.concat(LINKS) : LINKS;
      const idx = Math.floor(Date.now() / 1000) % pool.length;
      const { name, text, link } = pool[idx];
      // Persist the impression + per-link view without blocking the response.
      const work = Promise.all([
        incrCount(env, "imp:" + key, memImpressions),
        incrCount(env, "views:" + name, memViews),
      ]);
      const persist = work.catch(() => {}); // best-effort; a failed KV write just drops the count
      if (ctx && ctx.waitUntil) ctx.waitUntil(persist);
      else await persist;
      return json({ copy: text, name, link });
    }

    if (path === "/market") {
      const pledgeLinks = (await getPledges(env)).map(pledgeToLink);
      const market = pledgeLinks.concat(LINKS);
      const views = await Promise.all(market.map((l) => getCount(env, "views:" + l.name, memViews)));
      return json({ market: market.map((l, i) => ({ ...l, views: views[i] })) });
    }

    if (path === "/pledge") {
      if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
      let body;
      try {
        body = await req.json();
      } catch (_) {
        return json({ error: "invalid JSON" }, 400);
      }
      let link;
      try {
        link = cleanUrl(body.link || body.url);
      } catch (err) {
        return json({ error: err.message || "invalid URL" }, 400);
      }
      const name = cleanText(body.name || body.advertiser, 60);
      const text = cleanText(body.text || body.copy || body.message, 90);
      const pledge = Math.max(0, Math.round(Number(body.pledge || body.donation || body.amount || 0)));
      if (!name) return json({ error: "name required" }, 400);
      if (!text) return json({ error: "message required" }, 400);
      if (!pledge) return json({ error: "future donation amount required" }, 400);
      const item = {
        id: "pledge-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
        name,
        text,
        link,
        pledge,
        createdAt: Date.now(),
      };
      const pledges = await savePledges(env, [item].concat(await getPledges(env)));
      return json({ ok: true, pledge: item, count: pledges.length });
    }

    if (path === "/me") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      const impressions = await getCount(env, "imp:" + key, memImpressions);
      return json({ key, impressions, payouts: "live" });
    }

    return json({ ok: true, service: "topbid" });
  },
};
