// Prepare docs/ for deploy: list every file in sw.js PRECACHE and bump CACHE_VERSION.
//   node tools/release.mjs
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('../docs/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const skip = new Set(['sw.js', '.gitkeep']);

// audio/audio.json tells the game which sound files exist, so it never probes for missing ones
const audioDir = join(root, 'audio');
const sounds = readdirSync(audioDir).filter((n) => /\.(ogg|mp3|wav)$/i.test(n)).sort();
writeFileSync(join(audioDir, 'audio.json'), JSON.stringify(sounds) + '\n');
console.log(`audio: ${sounds.length ? sounds.join(', ') : '(none)'}`);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!skip.has(name)) files.push(relative(root, p).split(sep).join('/'));
  }
})(root);
files.sort();

const swPath = join(root, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
const list = ['./', ...files].map((f) => `  '${f}',`).join('\n');
sw = sw.replace(/\/\/ PRECACHE-START[\s\S]*?\/\/ PRECACHE-END/, `// PRECACHE-START\nconst PRECACHE = [\n${list}\n];\n// PRECACHE-END`);
const m = sw.match(/const CACHE_VERSION = 'v(\d+)';/);
const next = m ? Number(m[1]) + 1 : 1;
sw = sw.replace(/const CACHE_VERSION = 'v\d+';/, `const CACHE_VERSION = 'v${next}';`);
writeFileSync(swPath, sw);
console.log(`sw.js: ${files.length + 1} files, CACHE_VERSION v${next}`);
