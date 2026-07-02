#!/usr/bin/env node
/**
 * Minimal VT100/ANSI screen emulator.
 *
 * Ink emits incremental terminal updates (cursor moves + line erases), not a
 * fresh full-screen frame each render, so you cannot reconstruct the visible
 * screen by splitting the byte stream on a home sequence. This replays the
 * whole captured stream into a fixed grid and prints the final visible screen.
 *
 * Usage: node vt.cjs <capture-file> [rows=30] [cols=120]
 *
 * Notes:
 * - SGR/color (\x1b[...m) is intentionally dropped — we want layout, not color.
 * - Multibyte UTF-8 glyphs (borders, emoji) occupy one cell here; alignment of
 *   wide glyphs may differ by a column from a real terminal, which is fine for
 *   verifying structure (overlap, overflow, masking, status-bar integrity).
 */
'use strict';
const fs = require('fs');

function emulate(s, rows, cols) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
  let r = 0;
  let c = 0;
  const clampR = () => { if (r < 0) r = 0; if (r >= rows) r = rows - 1; };
  const clampC = () => { if (c < 0) c = 0; if (c >= cols) c = cols - 1; };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\x1b') {
      if (s[i + 1] === '[') {
        let j = i + 2;
        let params = '';
        while (j < s.length && /[0-9;?]/.test(s[j])) { params += s[j]; j++; }
        const fin = s[j];
        const nums = params.replace('?', '').split(';').map((x) => (x === '' ? undefined : parseInt(x, 10)));
        const n = nums[0];
        switch (fin) {
          case 'H': case 'f': r = (nums[0] || 1) - 1; c = (nums[1] || 1) - 1; clampR(); clampC(); break;
          case 'A': r -= (n || 1); clampR(); break;
          case 'B': r += (n || 1); clampR(); break;
          case 'C': c += (n || 1); clampC(); break;
          case 'D': c -= (n || 1); clampC(); break;
          case 'G': c = (n || 1) - 1; clampC(); break;
          case 'd': r = (n || 1) - 1; clampR(); break;
          case 'J': {
            const m = n || 0;
            if (m === 2 || m === 3) { for (let y = 0; y < rows; y++) grid[y].fill(' '); }
            else if (m === 0) { for (let x = c; x < cols; x++) grid[r][x] = ' '; for (let y = r + 1; y < rows; y++) grid[y].fill(' '); }
            else if (m === 1) { for (let x = 0; x <= c; x++) grid[r][x] = ' '; for (let y = 0; y < r; y++) grid[y].fill(' '); }
            break;
          }
          case 'K': {
            const m = n || 0;
            if (m === 0) { for (let x = c; x < cols; x++) grid[r][x] = ' '; }
            else if (m === 1) { for (let x = 0; x <= c; x++) grid[r][x] = ' '; }
            else { grid[r].fill(' '); }
            break;
          }
          default: break; // SGR (m), mode set/reset (h/l), etc. — ignored
        }
        i = j + 1;
        continue;
      }
      i += 2; // other ESC X — skip
      continue;
    }
    if (ch === '\r') { c = 0; i++; continue; }
    if (ch === '\n') { r++; c = 0; clampR(); i++; continue; }
    if (ch === '\x07' || ch === '\b') { i++; continue; }
    if (grid[r]) grid[r][c] = ch;
    c++;
    if (c >= cols) c = cols - 1;
    i++;
  }
  return grid.map((row) => row.join('').replace(/\s+$/, '')).join('\n');
}

const file = process.argv[2];
const rows = parseInt(process.argv[3] || '30', 10);
const cols = parseInt(process.argv[4] || '120', 10);
if (!file) {
  console.error('usage: node vt.cjs <capture-file> [rows] [cols]');
  process.exit(1);
}
const raw = fs.readFileSync(file, 'utf8');
const screen = emulate(raw, rows, cols);
const lines = screen.split('\n');
console.log(`=== FINAL SCREEN (${lines.length} lines, ${cols} cols) ===`);
lines.forEach((l, idx) => console.log(String(idx).padStart(3) + ' |' + l));
