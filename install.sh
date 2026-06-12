#!/usr/bin/env bash
# install.sh - one-command installer for TopBid (Claude Code statusLine link renderer)
#
#   curl -fsSL https://raw.githubusercontent.com/Alakazam03/kickbacks/main/install.sh | bash
#
# Zero extra dependencies for Claude Code users (uses Node, which Claude Code requires).
# Idempotent, self-narrating, and non-destructive to your settings.json.
set -u

REPO_RAW="${KICKBACKS_RAW:-https://raw.githubusercontent.com/Alakazam03/kickbacks/main}"
KB_DIR="$HOME/.kickbacks"
SETTINGS="$HOME/.claude/settings.json"
CMD="$KB_DIR/kickbacks.sh"
DEFAULT_ENDPOINT="${KICKBACKS_ENDPOINT:-https://topbid.bankingvaibhav.workers.dev}"

say()  { printf '\033[1;33mT$\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

say "TopBid installer — here's exactly what this does:"
say "  • writes a script to ~/.kickbacks/"
say "  • adds a 'statusLine' key to ~/.claude/settings.json (backs up the old one first)"
say "  • calls the TopBid Worker to refresh the live link queue"
echo

command -v node >/dev/null 2>&1 || die "Node is required (Claude Code needs it too). Install Node and re-run."

mkdir -p "$KB_DIR" "$HOME/.claude"

if [ -f "./kickbacks.sh" ]; then
  cp ./kickbacks.sh "$KB_DIR/kickbacks.sh"; [ -f ./ads.json ] && cp ./ads.json "$KB_DIR/ads.json"
else
  curl -fsSL "$REPO_RAW/kickbacks.sh" -o "$KB_DIR/kickbacks.sh" || die "could not download kickbacks.sh"
  [ -s "$KB_DIR/ads.json" ] || curl -fsSL "$REPO_RAW/ads.json" -o "$KB_DIR/ads.json" 2>/dev/null
fi
chmod +x "$KB_DIR/kickbacks.sh"
printf '%s\n' "$DEFAULT_ENDPOINT" > "$KB_DIR/endpoint"
rm -f "$KB_DIR/current_ad.txt"

# merge statusLine with node — abort rather than clobber an unparseable file
if [ -f "$SETTINGS" ]; then cp "$SETTINGS" "$SETTINGS.kickbacks.bak"; fi
node -e '
  const fs=require("fs"), p=process.argv[1], cmd=process.argv[2];
  let j={};
  if(fs.existsSync(p)){ const raw=fs.readFileSync(p,"utf8").trim();
    if(raw){ try{j=JSON.parse(raw)}catch(e){console.error("settings.json is not valid JSON — left untouched"); process.exit(2)} } }
  j.statusLine={type:"command",command:cmd};
  fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
' "$SETTINGS" "$CMD" || die "settings.json untouched (your backup, if any, is at $SETTINGS.kickbacks.bak)"

# pre-render so the very first paint is a real ad, not the placeholder
echo '{}' | "$KB_DIR/kickbacks.sh" >/dev/null 2>&1
touch -t 202001010000 "$KB_DIR/current_ad.txt" 2>/dev/null || true

say "installed."
[ -f "$SETTINGS.kickbacks.bak" ] && say "old settings backed up to $SETTINGS.kickbacks.bak"
say "restart Claude Code, accept the trust prompt, and the sponsored line appears at the bottom."
say "live endpoint set to $DEFAULT_ENDPOINT"
