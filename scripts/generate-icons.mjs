import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, {level: 9});
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function renderIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [11, 15, 14, 255]; // #0B0F0E
  const surface = [18, 26, 23, 255]; // #121A17
  const border = [38, 54, 47, 255]; // #26362F
  const emerald = [16, 185, 129, 255]; // #10B981
  const gold = [212, 175, 55, 255]; // #D4AF37

  const pad = maskable ? 0.16 : 0.06;
  const inner = 1 - pad * 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const idx = (y * size + x) * 4;

      let color = bg;

      // Normalized inside safe box
      const ux = (nx - pad) / inner;
      const uy = (ny - pad) / inner;

      if (ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1) {
        // Rounded rect surface
        const r = 0.2;
        const dx = Math.max(0, Math.abs(ux - 0.5) - (0.5 - r));
        const dy = Math.max(0, Math.abs(uy - 0.5) - (0.5 - r));
        const d = Math.hypot(dx, dy);
        if (d <= r) {
          color = d > r - 0.03 ? border : surface;

          // Shield contour
          const sx = (ux - 0.5) / 0.34;
          const sy = (uy - 0.48) / 0.36;
          const inShield =
            sy >= -0.95 &&
            sy <= 0.95 &&
            Math.abs(sx) <= (sy < 0.15 ? 0.92 : Math.max(0, 0.92 * (1 - ((sy - 0.15) / 0.85) ** 1.35)));

          const outerShield =
            sy >= -1.03 &&
            sy <= 1.04 &&
            Math.abs(sx) <= (sy < 0.15 ? 1.0 : Math.max(0, 1.0 * (1 - ((sy - 0.15) / 0.92) ** 1.35)));

          if (outerShield && !inShield) {
            color = emerald;
          } else if (inShield) {
            color = [24, 35, 30, 255];
          }

          // Checkmark stroke
          const d1 = distToSegment(ux, uy, 0.36, 0.52, 0.46, 0.62);
          const d2 = distToSegment(ux, uy, 0.46, 0.62, 0.65, 0.41);
          const strokeW = Math.max(0.038, 1.6 / size);
          if (Math.min(d1, d2) <= strokeW) {
            color = emerald;
          }

          // Subtle gold emblem dot at top of shield
          if (Math.hypot(ux - 0.5, uy - 0.26) <= 0.032) {
            color = gold;
          }
        }
      }

      buf[idx] = color[0];
      buf[idx + 1] = color[1];
      buf[idx + 2] = color[2];
      buf[idx + 3] = color[3];
    }
  }

  return encodePNG(size, size, buf);
}

const targets = [
  {out: 'public/pwa-192x192.png', size: 192, maskable: false},
  {out: 'public/pwa-512x512.png', size: 512, maskable: false},
  {out: 'public/pwa-maskable-512x512.png', size: 512, maskable: true},
  {out: 'public/apple-touch-icon.png', size: 180, maskable: false},
  {out: 'extension/assets/icon-16.png', size: 16, maskable: false},
  {out: 'extension/assets/icon-48.png', size: 48, maskable: false},
  {out: 'extension/assets/icon-128.png', size: 128, maskable: false},
];

for (const t of targets) {
  const full = path.resolve(process.cwd(), t.out);
  fs.mkdirSync(path.dirname(full), {recursive: true});
  fs.writeFileSync(full, renderIcon(t.size, t.maskable));
}

console.log(`Generated ${targets.length} WAFA FormAssist PNG icon assets.`);
