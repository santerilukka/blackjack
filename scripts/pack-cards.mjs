#!/usr/bin/env node
/**
 * Packs individual card PNGs into a PixiJS-compatible sprite sheet.
 *
 * Input:  packages/frontend/assets/cards/pngs/*.png
 * Output: packages/frontend/public/cards/cards.png   (atlas texture)
 *         packages/frontend/public/cards/cards.json   (PixiJS Spritesheet descriptor)
 *
 * Naming convention in the atlas:
 *   face cards  → {rank}_{suit}   e.g. ace_spades, 10_hearts, king_clubs
 *   card backs  → back_{color}_{n} e.g. back_blue_1
 *   jokers      → joker_{color}    e.g. joker_red
 */

import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_DIR = join(ROOT, 'packages/frontend/assets/cards/pngs');
const OUT_DIR = join(ROOT, 'packages/frontend/public/cards');

// Map source file rank numbers to standard rank names
const RANK_MAP = {
  '1': 'ace', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  '11': 'jack', '12': 'queen', '13': 'king',
};

// Map source suit names to lowercase standard names
const SUIT_MAP = {
  'clubs': 'clubs',
  'diamond': 'diamonds',
  'hearts': 'hearts',
  'spades': 'spades',
};

/**
 * Convert a source filename like "Clubs 10.png" → "10_clubs"
 * or "Back Blue 1.png" → "back_blue_1"
 * or "Joker Red.png" → "joker_red"
 */
function fileToFrameName(filename) {
  const name = filename.replace(/\.png$/i, '');

  // Jokers
  const jokerMatch = name.match(/^Joker\s+(\w+)$/i);
  if (jokerMatch) return `joker_${jokerMatch[1].toLowerCase()}`;

  // Backs
  const backMatch = name.match(/^Back\s+(\w+)\s+(\d+)$/i);
  if (backMatch) return `back_${backMatch[1].toLowerCase()}_${backMatch[2]}`;

  // Face cards: "Suit Rank"
  const cardMatch = name.match(/^(\w+)\s+(\d+)$/i);
  if (cardMatch) {
    const suitKey = cardMatch[1].toLowerCase();
    const rankKey = cardMatch[2];
    const suit = SUIT_MAP[suitKey] || suitKey;
    const rank = RANK_MAP[rankKey] || rankKey;
    return `${rank}_${suit}`;
  }

  // Fallback — sanitise
  return name.toLowerCase().replace(/\s+/g, '_');
}

async function main() {
  // Read all PNGs
  const files = (await readdir(SRC_DIR)).filter(f => /\.png$/i.test(f)).sort();
  console.log(`Found ${files.length} card images`);

  // Load metadata for the first image to get card dimensions
  const sampleMeta = await sharp(join(SRC_DIR, files[0])).metadata();
  const cardW = sampleMeta.width;
  const cardH = sampleMeta.height;
  console.log(`Card size: ${cardW}×${cardH}`);

  // 1 pixel padding between cards
  const pad = 1;

  // Calculate grid — aim for roughly square atlas
  const cols = Math.ceil(Math.sqrt(files.length));
  const rows = Math.ceil(files.length / cols);
  const atlasW = cols * (cardW + pad) + pad;
  const atlasH = rows * (cardH + pad) + pad;
  console.log(`Atlas grid: ${cols}×${rows}  →  ${atlasW}×${atlasH}px`);

  // Build composite operations and frame data
  const composites = [];
  const frames = {};

  for (let i = 0; i < files.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (cardW + pad);
    const y = pad + row * (cardH + pad);
    const frameName = fileToFrameName(files[i]);

    composites.push({
      input: join(SRC_DIR, files[i]),
      left: x,
      top: y,
    });

    frames[frameName] = {
      frame: { x, y, w: cardW, h: cardH },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cardW, h: cardH },
      sourceSize: { w: cardW, h: cardH },
    };
  }

  // Create atlas PNG
  await mkdir(OUT_DIR, { recursive: true });

  const atlasPath = join(OUT_DIR, 'cards.png');
  await sharp({
    create: {
      width: atlasW,
      height: atlasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(atlasPath);

  console.log(`Wrote atlas: ${atlasPath}`);

  // Create PixiJS Spritesheet JSON
  const atlas = {
    frames,
    meta: {
      app: 'blackjack-card-packer',
      version: '1.0.0',
      image: 'cards.png',
      format: 'RGBA8888',
      size: { w: atlasW, h: atlasH },
      scale: '1',
    },
  };

  const jsonPath = join(OUT_DIR, 'cards.json');
  await writeFile(jsonPath, JSON.stringify(atlas, null, 2));
  console.log(`Wrote atlas descriptor: ${jsonPath}`);

  // Print frame names for verification
  console.log('\nFrame names:');
  Object.keys(frames).sort().forEach(n => console.log(`  ${n}`));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
