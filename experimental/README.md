# Experimental Thinking Indicator Path

Claude Code 2.1.x on this machine is a bundled native app:

`~/.local/share/claude/versions/2.1.175`

I checked the installed binaries for obvious spinner/thinking glyph targets (`✻`,
`✢`, `✳`, `✶`, `✽`, `✦`, `✧`, and the visible interrupt text). Those strings are
not exposed as stable text in the binary, so directly replacing Claude's dynamic
thinking indicator would be a brittle, version-specific binary patch.

`topbid-claude-thinking.sh` is an opt-in MVP for dynamic ad behavior while Claude
runs. It launches Claude normally and runs a small terminal ad ticker beside it.
It does not modify Claude.

Usage:

```bash
./experimental/topbid-claude-thinking.sh
```

Notes:

- This is not enabled by the default installer.
- It may be visually noisy because Claude owns the terminal UI.
- Keep payment handling out of this path for now.
- TODO: replace this wrapper with a supported Claude thinking-render hook if one
  becomes available.
