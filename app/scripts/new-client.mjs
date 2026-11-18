#!/usr/bin/env node
/**
 * Create a new white-label client from a WordPress/WooCommerce site that runs the StoreApp Connector plugin.
 *
 *   npm run client -- https://example.com [--slug example] [--bundle com.example.app] [--name "Example"]
 *
 * What it does:
 *   1. Reads https://example.com/wp-json/storeapp/v1/config (branding, colors, logo...)
 *   2. Downloads the logo / site icon and generates app icon, Android adaptive icon,
 *      splash image and Android notification icon in the brand colors.
 *   3. Writes clients/<slug>/client.json + config.json (offline snapshot for instant first launch)
 *   4. Switches the project to that client (same as `npm run use-client -- <slug>`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { useClient } from './use-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, def = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

const site = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(site)) {
  console.error('Usage: npm run client -- https://your-store.com [--slug name] [--bundle com.company.app] [--name "App name"]');
  process.exit(1);
}

const host = new URL(site).hostname.replace(/^www\./, '');
const slug = arg('slug', host.split('.')[0].replace(/[^a-z0-9]/gi, '').toLowerCase());
const bundle = arg('bundle', 'com.' + host.split('.').reverse().join('.').replace(/[^a-z0-9.]/gi, '').toLowerCase().replace(/^com\.com\./, 'com.') + '.app');

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'StoreApp-Builder/1.0' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function getBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'StoreApp-Builder/1.0' } });
  if (!res.ok) throw new Error(`${res.status} — ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), alpha: 1 };
}

/** Logo trimmed of empty borders, fitted inside a square with padding, over a background. */
async function squareImage(logo, size, padding, background) {
  const inner = Math.round(size * (1 - padding * 2));
  const trimmed = await sharp(logo).trim({ threshold: 10 }).toBuffer().catch(() => logo);
  const fitted = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fitted, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** White silhouette from the logo's alpha channel (Android status bar icon). */
async function notificationIcon(logo) {
  const base = await squareImage(logo, 96, 0.08, null);
  const { data, info } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 20) opaque++;
  const coverage = opaque / (info.width * info.height);
  for (let i = 0; i < data.length; i += 4) {
    // If the logo has no transparency (a full square), fall back to luminance.
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const a = coverage > 0.92 ? (lum < 200 ? 255 : 0) : data[i + 3];
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = a;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function main() {
  console.log(`→ Reading ${site}/wp-json/storeapp/v1/config`);
  let config;
  try {
    config = await getJson(`${site}/wp-json/storeapp/v1/config`);
  } catch (e) {
    console.error(`✖ Could not read the app config. Is the "StoreApp Connector" plugin installed and active on ${site}?\n  ${e.message}`);
    process.exit(1);
  }
  const name = arg('name', config.site?.name || slug);
  const colors = config.theme?.colors || {};
  const bg = colors.background || '#FFFFFF';
  const primary = colors.primary || '#111827';

  const dir = path.join(root, 'clients', slug);
  fs.mkdirSync(dir, { recursive: true });

  const logoUrl = config.site?.icon || config.site?.logo;
  if (logoUrl) {
    console.log(`→ Downloading logo ${logoUrl}`);
    const logo = await getBuffer(logoUrl);
    fs.writeFileSync(path.join(dir, 'icon.png'), await squareImage(logo, 1024, 0.14, hexToRgb(bg)));
    fs.writeFileSync(path.join(dir, 'adaptive-foreground.png'), await squareImage(logo, 1024, 0.27, null));
    fs.writeFileSync(path.join(dir, 'splash.png'), await squareImage(await getBuffer(config.site?.logo || logoUrl), 800, 0.05, null));
    fs.writeFileSync(path.join(dir, 'notification-icon.png'), await notificationIcon(logo));
  } else {
    console.warn('! No logo found on the site — using the default icons. Set a Site Icon in WordPress → Settings → General.');
  }

  const clientFile = path.join(dir, 'client.json');
  const previous = fs.existsSync(clientFile) ? JSON.parse(fs.readFileSync(clientFile, 'utf8')) : {};
  const client = {
    slug,
    name,
    siteUrl: site,
    bundleId: previous.bundleId || bundle,
    scheme: previous.scheme || slug,
    version: previous.version || '1.0.0',
    buildNumber: previous.buildNumber || 1,
    primary,
    background: bg,
    easProjectId: previous.easProjectId || '',
    owner: previous.owner || '',
  };
  fs.writeFileSync(clientFile, JSON.stringify(client, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));

  useClient(slug);
  console.log(`\n✔ Client "${name}" ready in clients/${slug}`);
  console.log(`  Bundle ID: ${client.bundleId}`);
  console.log('\nNext:');
  console.log('  npx eas-cli@latest init             # once per client; put the projectId in clients/' + slug + '/client.json');
  console.log('  npx eas-cli@latest build --profile development --platform android   # test build');
  console.log('  npx eas-cli@latest build --profile production --platform all        # store builds');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
