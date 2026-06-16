/**
 * Copia solo los assets VAD que deben servirse desde el mismo origen
 * (worklet + modelo Silero). ONNX Runtime WASM va por CDN (MIME .mjs correcto).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'vad');
const vadDist = join(root, 'node_modules', '@ricky0123', 'vad-web', 'dist');

const files = [
  'silero_vad_legacy.onnx',
  'vad.worklet.bundle.min.js',
];

if (!existsSync(vadDist)) {
  console.warn('[vad:assets] @ricky0123/vad-web no instalado — omitiendo copia');
  process.exit(0);
}

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
} else {
  for (const entry of readdirSync(outDir)) {
    const path = join(outDir, entry);
    if (statSync(path).isDirectory()) rmSync(path, { recursive: true, force: true });
    else rmSync(path, { force: true });
  }
}

for (const file of files) {
  const src = join(vadDist, file);
  if (!existsSync(src)) {
    console.warn(`[vad:assets] falta ${file}`);
    continue;
  }
  copyFileSync(src, join(outDir, file));
}

console.log(`[vad:assets] ${files.length} archivo(s) → public/vad`);
