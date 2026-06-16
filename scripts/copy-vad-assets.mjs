import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'vad');

const sources = [
  join(root, 'node_modules', '@ricky0123', 'vad-web', 'dist'),
  join(root, 'node_modules', 'onnxruntime-web', 'dist'),
];

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

for (const src of sources) {
  if (!existsSync(src)) {
    console.warn(`[vad:assets] skip missing: ${src}`);
    continue;
  }
  cpSync(src, outDir, { recursive: true });
}

console.log(`[vad:assets] copied to ${outDir}`);
