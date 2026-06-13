import worker from "./worker/worker.js";
import { readFile } from "node:fs/promises";

const ads = JSON.parse(await readFile(new URL("./ads.json", import.meta.url), "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const seedMarket = await worker.fetch(new Request("https://local/market"), {}, {}).then((r) => r.json());
assert(seedMarket.market.length === 10, "market should start with 10 seeded companies");
assert(seedMarket.market.every((item) => item.icon), "every seeded company should have an icon");
assert(ads.length === 10, "local fallback ads should include 10 companies");
assert(ads.every((item) => item.icon), "local fallback ads should include icons");

let res = await worker.fetch(
  new Request("https://local/pledge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Acme",
      icon: "AC",
      link: "https://example.com",
      text: "Acme - terminal ad",
      pledge: 50,
    }),
  }),
  {},
  {},
);
const pledge = await res.json();
assert(pledge.ok, "pledge should be accepted");

const marketWithPledge = await worker.fetch(new Request("https://local/market"), {}, {}).then((r) => r.json());
assert(marketWithPledge.market[0].name === "Acme", "pledge should appear first in market");
assert(marketWithPledge.market[0].icon === "AC", "pledge icon should be preserved");

const realNow = Date.now;
Date.now = () => 11_000;
const store = new Map([
  [
    "pledges:v1",
    JSON.stringify([
      {
        id: "p1",
        name: "High Pledge",
        icon: "HP",
        text: "High Pledge - after minute",
        link: "https://example.org/",
        pledge: 99,
        createdAt: 1,
      },
    ]),
  ],
  ["first:after-gate", String(-50_000)],
]);
const env = {
  TOPBID: {
    get: async (key) => store.get(key) || null,
    put: async (key, value) => {
      store.set(key, value);
    },
  },
};
res = await worker.fetch(new Request("https://local/ad?key=after-gate"), env, {});
Date.now = realNow;
const afterGateAd = await res.json();
assert(afterGateAd.name === "High Pledge", "pledges should enter /ad after 60 seconds");
assert(afterGateAd.icon === "HP", "ad response should include pledge icon");

const manyPledges = [];
for (let i = 0; i < 120; i += 1) {
  manyPledges.push({
    id: "p" + i,
    name: "Company " + i,
    icon: "C" + i,
    text: "Company " + i,
    link: "https://example.com/" + i,
    pledge: i,
    createdAt: i,
  });
}
const capStore = new Map([["pledges:v1", JSON.stringify(manyPledges)]]);
const capEnv = {
  TOPBID: {
    get: async (key) => capStore.get(key) || null,
    put: async (key, value) => {
      capStore.set(key, value);
    },
  },
};
await worker.fetch(
  new Request("https://local/pledge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Top Bidder",
      icon: "TOP",
      link: "https://example.net",
      text: "Top Bidder",
      pledge: 999,
    }),
  }),
  capEnv,
  {},
);
const capped = JSON.parse(capStore.get("pledges:v1"));
assert(capped.length === 100, "pledge table should cap at 100 companies");
assert(capped[0].name === "Top Bidder", "pledge table should sort by pledge amount");

console.log("topbid mvp checks passed");
