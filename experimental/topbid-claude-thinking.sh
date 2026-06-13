#!/usr/bin/env bash
# Experimental TopBid launcher for Claude Code.
#
# This does not patch Claude's internal thinking indicator. Claude Code 2.1.x is
# a bundled native app on macOS, and the spinner glyph/string is not exposed as a
# stable text target in the installed binary. This wrapper gives us a minimal
# dynamic-ad MVP while Claude runs, without modifying the Claude binary.
#
# TODO: If Anthropic exposes a supported thinking-render hook, move this behavior
# there and remove the terminal-overlay fallback.
set -u

TB_DIR="${TOPBID_DIR:-$HOME/.topbid}"
RENDERER="${TOPBID_RENDERER:-$TB_DIR/topbid.sh}"
CLAUDE_BIN="${TOPBID_CLAUDE_BIN:-$(command -v claude 2>/dev/null || true)}"
INTERVAL="${TOPBID_THINKING_INTERVAL:-4}"

die() { printf 'topbid-thinking: %s\n' "$1" >&2; exit 1; }

[ -n "$CLAUDE_BIN" ] || die "claude not found"
[ -x "$RENDERER" ] || die "renderer not found at $RENDERER"

if [ ! -t 2 ]; then
  exec "$CLAUDE_BIN" "$@"
fi

cleanup() {
  [ -n "${ticker_pid:-}" ] && kill "$ticker_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  while :; do
    ad="$(printf '{}' | "$RENDERER" 2>/dev/null | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
    if [ -n "$ad" ]; then
      # Keep this intentionally short and carriage-return based. It is best-effort:
      # Claude owns the TUI, so this may be visually noisy in some terminals.
      printf '\r%s' "$ad" >&2
    fi
    sleep "$INTERVAL"
  done
) &
ticker_pid="$!"

"$CLAUDE_BIN" "$@"
status=$?
cleanup
printf '\r\033[K' >&2
exit "$status"
