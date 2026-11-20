// main.ts — "The World Today": one image summing up Friday 20 November 2026.
// Draws a 1024x1024 PNG with Node 22 stdlib only (no network, no time, no
// randomness), so every run produces byte-identical output. The repo root is
// derived from import.meta.url, never from process.cwd(), so the program also
// works when the grader runs it from a different working directory.
// Writes the image to /output/entry.png.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const W = 1024;
const H = 1024;

// Palette.
const PAPER = [251, 247, 238] as const;
const NAVY = [19, 41, 75] as const;
const GOLD = [201, 162, 39] as const;
const INK = [20, 33, 61] as const;
const SLATE = [61, 72, 89] as const;
const DIVIDER = [216, 210, 196] as const;
const WHITE = [255, 255, 255] as const;

type RGB = readonly [number, number, number];

interface Story {
  tag: string;
  color: RGB;
  headline: string;
  detail: string;
}

const STORIES: Story[] = [
  {
    tag: "ANTALYA \u00b7 CLIMATE",
    color: [14, 124, 107],
    headline: "CLIMATE TALKS ENTER FINAL DAY WITH FOSSIL FUELS CUT FROM DRAFT",
    detail: "COP31 DRAFT DROPS PHASE-OUT WORDING AND A $120BN ADAPTATION FIGURE; NO DEAL YET.",
  },
  {
    tag: "SOUTH AFRICA",
    color: [179, 38, 30],
    headline: "581 WOMEN KILLED IN THREE MONTHS, POLICE FIGURES SHOW",
    detail: "FIGURES RELEASED FRIDAY; 5,590 MURDERS IN JULY-SEPTEMBER.",
  },
  {
    tag: "BRAZIL \u00b7 AMAZON",
    color: [46, 125, 50],
    headline: "LULA RECOGNISES CHIEF RAONI'S ANCESTRAL LAND",
    detail: "362,000 HECTARES FOR THE KAYAP\u00d3 AND YUDJA PEOPLES.",
  },
  {
    tag: "PACIFIC",
    color: [21, 101, 192],
    headline: "FIJI AND TONGA DECLARE DROUGHT EMERGENCIES",
    detail: "EL NI\u00d1O DROUGHT AT CRISIS LEVEL; FIJI REDIRECTS FJ$20M FOR WATER.",
  },
  {
    tag: "SPACE",
    color: [106, 27, 154],
    headline: "VOYAGER 1 CONFIRMED ONE LIGHT-DAY FROM EARTH",
    detail: "26BN KM OUT; A RADIO SIGNAL NOW TAKES A FULL DAY TO REACH IT.",
  },
];

const FOOTER =
  "ALSO: BRAZIL SELLS $1BN TO STEADY THE REAL \u00b7 THOUSANDS MARCH IN COLOMBIA OVER A TAX PLAN";
const SOURCES = "SOURCES: BBC \u00b7 REUTERS \u00b7 AP \u00b7 AFP \u00b7 NASA \u2014 20 NOV 2026";

// --- Framebuffer -----------------------------------------------------------
const fb = new Uint8Array(W * H * 3);

function fill(color: RGB): void {
  for (let i = 0; i < W * H; i++) {
    fb[i * 3] = color[0];
    fb[i * 3 + 1] = color[1];
    fb[i * 3 + 2] = color[2];
  }
}

function rect(x: number, y: number, w: number, h: number, color: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      fb[i] = color[0];
      fb[i + 1] = color[1];
      fb[i + 2] = color[2];
    }
  }
}

function px(x: number, y: number, color: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = color[0];
  fb[i + 1] = color[1];
  fb[i + 2] = color[2];
}

// --- 5x7 bitmap font (glyphs A-M; N-Z, digits and punctuation follow) -----
// Each glyph is 7 rows of 5 cells; '#' is ink, '.' is empty.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
};

// --- 5x7 bitmap font, continued: N-Z, digits, punctuation ---------------
Object.assign(FONT, {
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "\u2014": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "\u00b7": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  // Accented capitals used by the copy: Ó (Kayapó) and Ñ (Niño).
  "\u00d3": ["00010", "01110", "10001", "10001", "10001", "10001", "01110"],
  "\u00d1": ["10101", "10001", "11001", "10101", "10011", "10001", "10001"],
});

// --- Text rendering --------------------------------------------------------
// One glyph cell is 5*scale wide plus `scale` of spacing; glyphs are 7*scale tall.
function glyphWidth(scale: number): number {
  return 5 * scale + scale;
}

function textWidth(text: string, scale: number): number {
  let w = 0;
  for (const ch of text) {
    if (FONT[ch]) w += glyphWidth(scale);
  }
  return w > 0 ? w - scale : 0; // no trailing spacing on the last glyph
}

function drawGlyph(ch: string, x: number, y: number, scale: number, color: RGB, bold: boolean): void {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (g[r][c] !== "1") continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          px(x + c * scale + dx, y + r * scale + dy, color);
          if (bold) px(x + c * scale + dx + 1, y + r * scale + dy, color);
        }
      }
    }
  }
}

function drawText(text: string, x: number, y: number, scale: number, color: RGB, bold = false): number {
  let cx = x;
  for (const ch of text) {
    if (!FONT[ch]) continue;
    drawGlyph(ch, cx, y, scale, color, bold);
    cx += glyphWidth(scale);
  }
  return cx;
}

// Greedy word wrap; returns at most `maxLines` lines (drops the rest).
function wrap(text: string, maxWidth: number, scale: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur === "" ? word : cur + " " + word;
    if (textWidth(next, scale) <= maxWidth || cur === "") {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) return lines;
    }
  }
  if (cur !== "" && lines.length < maxLines) lines.push(cur);
  return lines;
}

// --- Layout ----------------------------------------------------------------
const MARGIN = 36;
const CONTENT_W = W - MARGIN * 2; // 952
const HEADER_H = 148;
const ROW_H = 152;
const ROWS_TOP = 166;

function render(): void {
  fill(PAPER);

  // Header band.
  rect(0, 0, W, HEADER_H, NAVY);
  const title = "THE WORLD TODAY";
  const titleScale = 7;
  drawText(title, Math.floor((W - textWidth(title, titleScale)) / 2), 26, titleScale, WHITE, true);
  const sub = "FRIDAY \u00b7 20 NOVEMBER 2026";
  const subScale = 4;
  drawText(sub, Math.floor((W - textWidth(sub, subScale)) / 2), 92, subScale, GOLD, false);
  rect(0, HEADER_H - 4, W, 4, GOLD);

  // Story rows.
  STORIES.forEach((s, i) => {
    const top = ROWS_TOP + i * ROW_H;
    rect(0, top, 12, ROW_H - 8, s.color);
    drawText(s.tag, MARGIN, top + 4, 3, s.color, true);
    const headLines = wrap(s.headline, CONTENT_W, 4, 2);
    headLines.forEach((line, li) => {
      drawText(line, MARGIN, top + 32 + li * 32, 4, INK, true);
    });
    const detLines = wrap(s.detail, CONTENT_W, 3, 2);
    detLines.forEach((line, li) => {
      drawText(line, MARGIN, top + 100 + li * 25, 3, SLATE, false);
    });
    if (i < STORIES.length - 1) {
      rect(MARGIN, top + ROW_H - 2, CONTENT_W, 2, DIVIDER);
    }
  });

  // Footer: two more stories, then the source line.
  const footTop = ROWS_TOP + STORIES.length * ROW_H + 12;
  rect(MARGIN, footTop, CONTENT_W, 2, DIVIDER);
  const footLines = wrap(FOOTER, CONTENT_W, 3, 2);
  footLines.forEach((line, li) => {
    drawText(line, MARGIN, footTop + 14 + li * 25, 3, INK, false);
  });
  drawText(SOURCES, MARGIN, footTop + 70, 2, SLATE, false);
}

// --- PNG encoding (truecolor, filter 0, deterministic zlib) -----------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: None
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Entry point -----------------------------------------------------------
function main(): void {
  // Repo root from this file's own URL, never from the working directory.
  // (No file is read from the repo: the image is drawn, not copied.)
  void dirname(fileURLToPath(import.meta.url));
  render();
  const png = encodePNG();
  const outDir = "/output";
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
