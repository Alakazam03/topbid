---
name: topbid-setup
description: Use when the user wants to install, set up, configure, or uninstall TopBid — the tool that renders a live link line in the Claude Code status bar. Triggers on phrases like "set up topbid", "install topbid", "status line links", "Claude Code link queue". Performs a privacy audit of the downloaded script BEFORE installing anything.
---

# TopBid setup

You are setting up TopBid on the user's machine. TopBid shows a live link line in
the Claude Code status bar. Your job is to install it **transparently** so the user can
trust it. Do the privacy disclosure and the script audit BEFORE writing anything to disk.
If any check fails, STOP and tell the user.

## Step 1 — Disclose, before touching anything

Tell the user plainly, in your own words, what this does and does not access:

- It does **not** read their code, file contents, prompts, conversation, environment
  variables, secrets, or the session JSON Claude Code pipes to the status line. The
  renderer drains that JSON and discards it.
- The status bar will show **persistent** link content — visible the whole session,
  not only while waiting.
- The only thing that ever leaves the machine is an **anonymous random key** (a UUID with
  no identity attached) used to count ad impressions — and only if a live ad endpoint is
  configured. With no endpoint set, it runs fully offline and nothing leaves the machine.

Ask the user to confirm they want to proceed. Do not continue without a yes.

## Step 2 — Preflight

- Confirm the OS is macOS or Linux (Windows: point them to Git Bash / WSL and stop).
- Check `jq` is installed (`command -v jq`). If missing, give the install command
  (`brew install jq` or `sudo apt-get install jq`) and stop until it's present.

## Step 3 — Download and AUDIT (do not skip)

Download the files to a temp dir first — do NOT place them yet:

    REPO_RAW="https://raw.githubusercontent.com/Alakazam03/topbid/main"
    tmp="$(mktemp -d)"
    curl -fsSL "$REPO_RAW/topbid.sh" -o "$tmp/topbid.sh"
    curl -fsSL "$REPO_RAW/ads.json"     -o "$tmp/ads.json"

Now READ `$tmp/topbid.sh` in full and verify, out loud to the user, that it:

1. Makes no outbound network call except to the ad endpoint in `TOPBID_ENDPOINT`,
   and sends nothing in that call but the anonymous key.
2. Reads and writes nothing outside `~/.topbid` (plus printing one line to stdout).
3. Contains no `eval` of remote content, no credential/file exfiltration, no obfuscation.

Report what you found in plain language. **If the script does anything beyond the above,
STOP, show the user the offending lines, and do not install.** This audit is the point of
the skill — a real check the user watches you perform, not a reassurance.

## Step 4 — Install (only after a clean audit)

    mkdir -p "$HOME/.topbid"
    cp "$tmp/topbid.sh" "$HOME/.topbid/topbid.sh"
    cp "$tmp/ads.json"  "$HOME/.topbid/ads.json"
    chmod +x "$HOME/.topbid/topbid.sh"

## Step 5 — Configure the status line (NON-destructive)

Never overwrite `~/.claude/settings.json`. Back it up, then merge the one key with jq, and
only commit on success. Show the user exactly what changed.

    S="$HOME/.claude/settings.json"; mkdir -p "$HOME/.claude"
    CMD="$HOME/.topbid/topbid.sh"
    if [ -f "$S" ]; then
      cp "$S" "$S.topbid.bak"
      t="$(mktemp)"
      jq --arg cmd "$CMD" '.statusLine={type:"command",command:$cmd}' "$S" > "$t" \
        && mv "$t" "$S" || { rm -f "$t"; echo "settings.json unparseable — left untouched"; }
    else
      jq -n --arg cmd "$CMD" '{statusLine:{type:"command",command:$cmd}}' > "$S"
    fi

## Step 6 — Confirm

- Test it the way Claude Code calls it: `echo '{}' | ~/.topbid/topbid.sh` — expect one
  styled line like `T$ Vaibhav Aggarwal · connect on LinkedIn · ad`.
- Tell the user to restart Claude Code and accept the workspace-trust prompt (statusLine is
  shell-executing, so it needs the same trust as hooks).
- Remind them: no `TOPBID_ENDPOINT` set = offline, nothing leaves the machine. To go live
  and start reading the live queue, they set that variable to the Worker endpoint.

## Uninstall

If asked to remove it: restore `~/.claude/settings.json` from `.topbid.bak` (or delete the
`statusLine` key with jq), and `rm -rf ~/.topbid`.
