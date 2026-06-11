// Generates the PWA icon set as flat-color PNGs — a 5×5 board motif in
// the Morning Paper palette — with zero image dependencies (raw RGBA →
// zlib → PNG chunks). Run: node scripts/genIcons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const PAPER = hex('#faf7f1');
const RAISED = hex('#ffffff');
const RULE = hex('#d9d1c0');
const FELT = hex('#1f5d43');
const RED = hex('#b3262e');
const NAVY = hex('#28486e');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const png = (size, pixelAt) => {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// 5×5 tile motif: paper field, raised tiles with rule-colored gutters;
// felt center, one red and one navy accent tile.
const drawIcon = size => {
  const margin = Math.round(size * 0.14); // maskable safe zone
  const board = size - margin * 2;
  const gap = Math.max(2, Math.round(board * 0.02));
  const tile = (board - gap * 4) / 5;
  const accents = { '2,2': FELT, '1,3': RED, '3,1': NAVY };
  return png(size, (x, y) => {
    const bx = x - margin;
    const by = y - margin;
    if (bx < 0 || by < 0 || bx >= board || by >= board) return PAPER;
    const cx = Math.min(4, Math.floor(bx / (tile + gap)));
    const cy = Math.min(4, Math.floor(by / (tile + gap)));
    const inTileX = bx - cx * (tile + gap) < tile;
    const inTileY = by - cy * (tile + gap) < tile;
    if (!inTileX || !inTileY) return RULE;
    return accents[`${cx},${cy}`] ?? RAISED;
  });
};

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512, 180]) {
  const name =
    size === 180 ? 'public/apple-touch-icon.png' : `public/icons/icon-${size}.png`;
  writeFileSync(name, drawIcon(size));
  console.log('wrote', name);
}
