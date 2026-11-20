// Sunfall City — entry program for make.fun competition gta6-01.
//
// The game itself is the game/ folder: plain static files (game/index.html and
// classic scripts under game/js/, no build step, no network) that any static
// HTTP server can serve to desktop Chrome. This program hands the entry in:
// it copies game/ and screenshots/ from beside this file to the output
// directory and writes dossier.json — the judge's summary — with
// buildDossier() from the kit's vendored library, vendor/makefun-game.ts.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with:  node serve.ts  ->  http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps (reference/gate.json). The caps below mirror what the
// scorer refuses — more than 4 screenshots or one over 256 KiB, more than
// 993 game files or 48 MiB of game files, or a game path over 1000 bytes —
// and text_max_bytes shapes the dossier's source text.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
