---
name: snapshot-tui
description: Take a headless "screenshot" of the paramhub TUI to verify a UI change without a real terminal. Drives the built CLI under expect in a pseudo-terminal, captures the alt-screen byte stream, and replays it through a VT100 emulator to print the final visible screen. Use when asked to verify/see/screenshot a TUI screen, confirm an overlay/layout/rendering change, or reproduce a rendering bug (overflow, bleed, masking, status-bar corruption).
---

# snapshot-tui

paramhub is an Ink (React) terminal UI. It's interactive and renders to the
alternate screen, so you normally can't "see" a change from a non-interactive
shell. This skill captures a real frame anyway.

## How it works

1. Builds `@paramhub/app` (optional) so `dist/cli.js` is current.
2. Launches the CLI inside a pseudo-terminal via `expect`, at a fixed size, and
   sends a scripted sequence of waits + keystrokes.
3. Logs the raw terminal byte stream.
4. Replays that stream through `scripts/vt.cjs`, a minimal VT100 emulator, and
   prints the final visible screen as a numbered grid.

Why the emulator: Ink emits *incremental* updates (cursor moves + line erases),
not a fresh full frame per render — so you can't just grab "the last frame" from
the byte stream. The emulator reconstructs the actual on-screen grid.

## Usage

```bash
.claude/skills/snapshot-tui/scripts/snapshot.sh [options] [--wait S | --key BYTES]...
```

Options:
- `--rows N` / `--cols N` — terminal size (default 30×120). Reproduce
  size-dependent bugs by varying these (e.g. `--rows 24` for tight heights,
  `--rows 48 --cols 200` for a large screen).
- `--build` — rebuild `@paramhub/app` first (do this after editing source).
- `--app "CMD"` — override the launch command (default `node dist/cli.js`, run
  from `packages/app`).
- `--wait S` / `--key BYTES` — applied **in order**, building the input script.

Keystroke bytes use `expect` escape syntax:
`\020`=Ctrl+P, `\021`=Ctrl+Q, `\r`=Enter, `\033`=Esc, `\033[B`=Down, `\033[A`=Up.
Single bytes (`\020`) and typed characters are delivered reliably; multi-byte
arrow sequences are sometimes dropped by the pty, so prefer driving via the
**command palette** (`\020`) or typing into search rather than arrow nav.

## Examples

Palette over the list view (default size), after editing source:
```bash
.claude/skills/snapshot-tui/scripts/snapshot.sh --build \
  --wait 2.2 --key '\020' --wait 1.8
```

Reproduce a layout/overflow bug at a tight height, then at a large one:
```bash
.claude/skills/snapshot-tui/scripts/snapshot.sh --rows 24 --cols 120 --wait 2.2 --key '\020' --wait 1.8
.claude/skills/snapshot-tui/scripts/snapshot.sh --rows 48 --cols 200 --wait 2.2 --key '\020' --wait 1.8
```

Just the initial screen (no input):
```bash
.claude/skills/snapshot-tui/scripts/snapshot.sh --wait 2.0
```

## Reaching a specific screen

There is no open-detail command in the palette, and arrow keys are flaky over
the pty, so to land on a screen that needs item selection (e.g. the **detail**
view) the most reliable option is a **temporary debug patch**: in
`packages/app/src/app.tsx` `AppInner`, add an effect that dispatches
`SET_SELECTED_ITEM` + `SET_VIEW: 'detail'` once `state.items` is populated,
`--build`, capture, then **revert the patch**. (Search-to-single-result + Enter
also opens an item, but typed timing is less reliable than the debug patch.)

## Reading the output

The grid is the literal screen. Check for: content present where expected,
overlays composited on top, modal interiors fully masked (no text bleeding
through), borders intact and inside bounds, and an uncorrupted bottom status
bar. Color is dropped (layout-only); wide glyphs may be off by a column — fine
for structural verification.

## Limitations

- Needs `expect` (preinstalled on macOS at `/usr/bin/expect`).
- Timing is sleep-based; bump `--wait` if async data (e.g. value loading) hasn't
  settled in the captured frame.
- Verifies structure, not exact colors.
