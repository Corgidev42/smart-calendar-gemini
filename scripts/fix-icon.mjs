/**
 * Recrop carré (sans écraser le ratio), transparence du fond via flood-fill depuis les bords,
 * puis 512×512 avec fond transparent pour Raycast.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const HD = path.join(root, "assets", "icon-hd.png");
const OUT = path.join(root, "assets", "icon.png");

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function lightness(r, g, b) {
  return (r + g + b) / 3;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

async function main() {
  if (!fs.existsSync(HD)) {
    console.error("Missing assets/icon-hd.png — place the non-squashed source there.");
    process.exit(1);
  }

  let { data, info } = await sharp(HD).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let w = info.width;
  let h = info.height;

  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2);
  const top = Math.floor((h - side) / 2);
  data = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: side, height: side })
    .ensureAlpha()
    .raw()
    .toBuffer();
  w = side;
  h = side;

  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let br = 0,
    bg = 0,
    bb = 0;
  for (const [x, y] of corners) {
    const i = (y * w + x) * 4;
    br += data[i];
    bg += data[i + 1];
    bb += data[i + 2];
  }
  br /= 4;
  bg /= 4;
  bb /= 4;

  const buf = Buffer.from(data);
  const visited = new Uint8Array(w * h);
  const queue = [];

  function isBackgroundPixel(r, g, b) {
    const d = colorDist(r, g, b, br, bg, bb);
    const L = lightness(r, g, b);
    const S = saturation(r, g, b);
    const nearSample = d < 58;
    const neutralBright = L > 172 && S < 0.24;
    return nearSample || neutralBright;
  }

  function tryVisit(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = idx * 4;
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    if (!isBackgroundPixel(r, g, b)) return;
    visited[idx] = 1;
    buf[i + 3] = 0;
    queue.push([x, y]);
  }

  for (let x = 0; x < w; x++) {
    tryVisit(x, 0);
    tryVisit(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryVisit(0, y);
    tryVisit(w - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    tryVisit(x + 1, y);
    tryVisit(x - 1, y);
    tryVisit(x, y + 1);
    tryVisit(x, y - 1);
  }

  const trimmed = await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .png()
    .toBuffer();

  await sharp(trimmed)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(OUT);

  const meta = await sharp(OUT).metadata();
  console.log("Wrote", OUT, meta.width, meta.height, "hasAlpha:", meta.hasAlpha);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
