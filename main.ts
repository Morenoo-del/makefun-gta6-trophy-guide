// Leonida Trophy Guide — entry builder for gta6-trophy-guide-01.
// Copies app/ and screenshots/ into the output directory and writes the
// dossier the scorer reads. Node 22, standard library only; deterministic.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
for (const name of ['app', 'screenshots']) {
  const src = join(here, name);
  if (!existsSync(src)) throw new Error(`Missing ${name}/ beside main.ts`);
  cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
if (!existsSync(dossierPath)) throw new Error(`Failed to write ${dossierPath}`);
console.log(`Wrote ${dossierPath} (${dossier.length} bytes)`);
console.log(`App: ${join(outDir, 'app')} — screenshots: ${join(outDir, 'screenshots')}`);
