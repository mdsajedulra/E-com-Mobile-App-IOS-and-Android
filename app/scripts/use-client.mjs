#!/usr/bin/env node
/**
 * Switch the project to a client:  npm run use-client -- <slug>
 * Also runs automatically on EAS Build (eas-build-pre-install) using the CLIENT env variable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function useClient(slug) {
  const dir = path.join(root, 'clients', slug);
  if (!fs.existsSync(path.join(dir, 'client.json'))) {
    throw new Error(`Unknown client "${slug}". Create it first: npm run client -- https://site.com --slug ${slug}`);
  }
  const snapshot = path.join(dir, 'config.json');
  const out = path.join(root, 'src', 'generated', 'snapshot.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, fs.existsSync(snapshot) ? fs.readFileSync(snapshot) : '{}');
  fs.writeFileSync(path.join(root, '.client'), slug + '\n');
  console.log(`✔ Active client: ${slug}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const slug = process.argv[2] || process.env.CLIENT;
  if (!slug) {
    if (fs.existsSync(path.join(root, '.client'))) {
      process.exit(0); // Keep the current client.
    }
    console.error('Usage: npm run use-client -- <slug>');
    process.exit(1);
  }
  useClient(slug.trim());
}
