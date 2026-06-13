#!/usr/bin/env bash
# topbid.sh — Claude Code statusLine link renderer (dependency-free)
# Prints exactly ONE line. ALWAYS exits 0. NEVER blocks the 300ms status-line tick.
# Warm path is a plain `cat` of a cached line. The only parsing (node) runs either once
# on the very first paint, or in a detached background refresh — never on a warm tick.

TB_DIR="${TOPBID_DIR:-$HOME/.topbid}"
ADS_FILE="${TOPBID_ADS:-$TB_DIR/ads.json}"
ENDPOINT="${TOPBID_ENDPOINT:-}"             # empty = offline; nothing leaves the machine
ENDPOINT_FILE="$TB_DIR/endpoint"
CACHE_FILE="$TB_DIR/current_ad.txt"
KEY_FILE="$TB_DIR/key"
INTERVAL_FILE="$TB_DIR/refresh_step"
LOCK_DIR="$TB_DIR/refresh.lock"

mkdir -p "$TB_DIR" 2>/dev/null
cat >/dev/null 2>&1                          # drain + discard the session JSON Claude Code pipes in

if [ -z "$ENDPOINT" ] && [ -s "$ENDPOINT_FILE" ]; then
  ENDPOINT="$(head -n 1 "$ENDPOINT_FILE" 2>/dev/null | tr -d '[:space:]')"
fi

if [ ! -s "$KEY_FILE" ]; then
  { uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || date +%s%N; } \
    | tr 'A-Z' 'a-z' > "$KEY_FILE" 2>/dev/null
fi
KEY="$(cat "$KEY_FILE" 2>/dev/null)"

Y=$'\033[1;33m'; CYAN=$'\033[1;36m'; BLUE=$'\033[1;34m'; GOLD=$'\033[1;33m'; DIM=$'\033[2m'; RST=$'\033[0m'
render() {
  copy="$1"; url="${2:-}"; icon="${3:-T$}"
  if [ -n "$url" ]; then
    printf '%s[%s]%s %s%s%s %s↗ %s%s%s' \
      "$Y" "$icon" "$RST" \
      "$CYAN" "$copy" "$RST" \
      "$DIM" \
      "$BLUE" "$url" "$RST"
  else
    printf '%s[%s]%s %s%s%s' \
      "$Y" "$icon" "$RST" \
      "$CYAN" "$copy" "$RST"
  fi
}

pick_local() {  # random copy + URL from ads.json, via node
  command -v node >/dev/null 2>&1 || return 1
  [ -s "$ADS_FILE" ] || return 1
  node -e 'try{const a=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    const t=a[Math.floor(Math.random()*a.length)]||{};
    process.stdout.write(JSON.stringify({icon:String(t.icon||"T$"),copy:String(t.copy||""),url:String(t.url||""),bid:Number(t.bid||1)}))}catch(e){}' "$ADS_FILE"
}

mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }  # GNU first, BSD fallback

refresh_interval() {
  step="$(cat "$INTERVAL_FILE" 2>/dev/null)"
  case "$step" in
    ''|*[!0-9]*) echo 1 ;;
    0|1|2) echo 1 ;;
    3) echo 2 ;;
    4) echo 4 ;;
    *) echo 60 ;;
  esac
}

advance_interval() {
  step="$(cat "$INTERVAL_FILE" 2>/dev/null)"
  case "$step" in ''|*[!0-9]*) step=0 ;; esac
  [ "$step" -lt 5 ] && step=$((step + 1))
  printf '%s\n' "$step" > "$INTERVAL_FILE" 2>/dev/null
}

render_payload() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{const x=JSON.parse(s);process.stdout.write(String(x.copy||"")+"\n"+String(x.url||"")+"\n"+String(x.icon||"T$"))}catch(e){}})' 2>/dev/null \
    | { IFS= read -r copy; IFS= read -r url; IFS= read -r icon; [ -n "$copy" ] && render "$copy" "$url" "$icon"; }
}

refresh() {  # background: pick link, count one impression, update cache
  payload=""
  if [ -n "$ENDPOINT" ]; then
    payload="$(curl -fsS --max-time 2 "$ENDPOINT/ad?key=$KEY" 2>/dev/null)"
  fi
  [ -z "$payload" ] && payload="$(pick_local)"
  [ -n "$payload" ] && printf '%s' "$payload" | render_payload > "$CACHE_FILE" 2>/dev/null
}

# --- main ---
need_refresh=0
if [ -s "$CACHE_FILE" ]; then
  cat "$CACHE_FILE"                                   # warm path: instant, no parser
  [ "$(( $(date +%s) - $(mtime "$CACHE_FILE") ))" -ge "$(refresh_interval)" ] && need_refresh=1
else
  payload="$(pick_local)"
  if [ -n "$payload" ]; then
    printf '%s' "$payload" | render_payload | tee "$CACHE_FILE"
  else
    render "TopBid - sell the idle line in your terminal" "https://topbid.bankingvaibhav.workers.dev" "T$" | tee "$CACHE_FILE"
  fi
  need_refresh=1
fi

if [ "$need_refresh" -eq 1 ]; then
  (
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT
      refresh
      advance_interval
    fi
  ) >/dev/null 2>&1 & disown 2>/dev/null
fi
exit 0
