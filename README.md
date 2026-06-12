# TopBid

A community link line in your Claude Code status bar. People can add links, and the renderer pulls from the live Worker queue.

## What it does

Claude Code lets you set a `statusLine` command, a script whose output shows at the bottom of the terminal. TopBid is that script. It prints the current top link, caches it, and refreshes in the background. The live queue and activity counters live in a small Cloudflare Worker.

The installer writes the live Worker endpoint to `~/.topbid/endpoint`, and the renderer calls `/ad` every 30 seconds. Links submitted into the Worker-backed list start appearing in terminals automatically after the local cache refreshes. `TOPBID_ENDPOINT` can override the endpoint for testing.

## What it touches (and what it doesn't)

It writes one script to `~/.topbid/` and adds a `statusLine` key to `~/.claude/settings.json`, backing up the old file first. It does not read your code, your prompts, your conversation, your environment variables, or the session data Claude Code hands the script. That input is dropped on the floor. The only thing that ever leaves your machine is a random key used to count ad views, and only once you set an endpoint. With no endpoint, it runs offline and nothing leaves.

## Install

```
curl -fsSL https://raw.githubusercontent.com/Alakazam03/topbid/main/install.sh | bash
```

Needs Node, which Claude Code already requires. Restart Claude Code and accept the trust prompt.

Prefer to watch it happen? Copy `skills/topbid-setup/` into `~/.claude/skills/` and tell Claude Code "set up TopBid". It will audit the script in front of you before installing anything.

## Earn

The installer points the renderer at the live Worker:

```
cat ~/.topbid/endpoint
# https://topbid.bankingvaibhav.workers.dev
```

Check activity any time:

```
curl "$TOPBID_ENDPOINT/me?key=$(cat ~/.topbid/key)"
```

TopBid is in beta. Developers keep 50% of net ad revenue after payment processing fees. Points track the impressions your terminal serves and count toward live payouts. Payouts are manual by UPI or PayPal once your balance reaches $10.

## Manage the link list

Public submissions go to `POST /submit`. The first 10 direct submissions are added straight to the live Worker/KV link list; later submissions are stored under `pending:*` for review.

Set an `ADMIN_TOKEN` Worker secret, then call the Worker to update the KV-backed live list:

```
wrangler secret put ADMIN_TOKEN
export ADMIN_TOKEN="your-token"
export TOPBID_ENDPOINT="https://topbid.bankingvaibhav.workers.dev"
```

Read the current live list:

```
curl "$TOPBID_ENDPOINT/admin/market?token=$ADMIN_TOKEN"
```

Add or replace one live link. If `id` already exists, it updates that row; otherwise it appends it:

```
curl -X POST "$TOPBID_ENDPOINT/admin/market?token=$ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"id":"vaibhav-linkedin","advertiser":"Vaibhav Aggarwal","copy":"Vaibhav Aggarwal - connect on LinkedIn","url":"https://www.linkedin.com/in/vaibhav-aggarwal-15070a138/","bid":1}'
```

Replace the full list:

```
curl -X POST "$TOPBID_ENDPOINT/admin/market/bulk?token=$ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"market":[{"id":"vaibhav-linkedin","advertiser":"Vaibhav Aggarwal","copy":"Vaibhav Aggarwal - connect on LinkedIn","url":"https://www.linkedin.com/in/vaibhav-aggarwal-15070a138/","bid":1,"source":"owner"}]}'
```

Delete one row:

```
curl -X POST "$TOPBID_ENDPOINT/admin/market/delete?id=some-link-id&token=$ADMIN_TOKEN"
```

## Caveats

- Impression counts use Cloudflare KV, which is eventually consistent. Fine for one machine, but it drops counts under concurrency. A real build uses a Durable Object per key.
- The ad endpoint is open. A per-key 20s cooldown stops a tight loop from minting impressions (an honest renderer pings every 30s, so it's unaffected), but this isn't settlement-grade: KV is still eventually consistent, and an attacker can rotate keys.
- It's the status bar, not the spinner, so the ad is persistent rather than shown only while waiting.

## Uninstall

```
rm -rf ~/.topbid
# then restore ~/.claude/settings.json from its .topbid.bak, or delete the statusLine key
```
