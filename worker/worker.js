import { LANDING_HTML } from "./landing.js";

// CONFIG — edit these to change the rotating links
const LINKS = [
  { name: "Vaibhav", text: "Hire me!", link: "https://www.linkedin.com/in/vaibhav-aggarwal-15070a138/" },
  { name: "Karnal Biofuels", text: "Free Clicks", link: "https://karnalbiofuels.in/" },
  { name: "Stately", text: "buy estamp anytime", link: "https://stately-frontend-staging.takemetoprod.com/" }
];

// Counters live in KV (binding TOPBID) so points + views survive restarts and
// cold starts. If the binding is missing (local dev before `wrangler kv ...`),
// we fall back to in-memory maps so nothing breaks — they just reset.
const memImpressions = new Map();
const memViews = new Map();

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

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
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
      const idx = Math.floor(Date.now() / 10000) % LINKS.length;
      const { name, text, link } = LINKS[idx];
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
      const views = await Promise.all(LINKS.map((l) => getCount(env, "views:" + l.name, memViews)));
      return json({ market: LINKS.map((l, i) => ({ ...l, views: views[i] })) });
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
