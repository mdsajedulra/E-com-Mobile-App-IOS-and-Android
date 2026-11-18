/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * White-label app config. The active client comes from the CLIENT env variable
 * (set per build profile / command) or the .client file written by `npm run use-client`.
 */
type Client = {
  slug: string;
  name: string;
  siteUrl: string;
  bundleId: string;
  scheme: string;
  version: string;
  buildNumber: number;
  primary: string;
  background: string;
  easProjectId?: string;
  owner?: string;
};

function activeClient(): Client {
  const fromFile = fs.existsSync(path.join(__dirname, '.client')) ? fs.readFileSync(path.join(__dirname, '.client'), 'utf8').trim() : '';
  const slug = (process.env.CLIENT || fromFile || 'ceramicbysarah').trim();
  const file = path.join(__dirname, 'clients', slug, 'client.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Client "${slug}" not found. Run: npm run client -- https://your-store.com`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Client;
}

function asset(slug: string, file: string, fallback: string) {
  const p = `./clients/${slug}/${file}`;
  return fs.existsSync(path.join(__dirname, p)) ? p : fallback;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const c = activeClient();
  const icon = asset(c.slug, 'icon.png', './assets/icon.png');
  const splash = asset(c.slug, 'splash.png', './assets/splash-icon.png');
  const notif = asset(c.slug, 'notification-icon.png', './assets/android-icon-monochrome.png');

  return {
    ...config,
    name: c.name,
    slug: c.slug,
    owner: c.owner || undefined,
    version: c.version,
    scheme: c.scheme,
    orientation: 'portrait',
    icon,
    userInterfaceStyle: 'automatic',
    backgroundColor: c.background,
    ios: {
      bundleIdentifier: c.bundleId,
      buildNumber: String(c.buildNumber),
      supportsTablet: true,
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: c.bundleId,
      versionCode: c.buildNumber,
      adaptiveIcon: {
        foregroundImage: asset(c.slug, 'adaptive-foreground.png', './assets/android-icon-foreground.png'),
        backgroundColor: c.background,
        monochromeImage: notif,
      },
      predictiveBackGestureEnabled: false,
      permissions: ['android.permission.POST_NOTIFICATIONS'],
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-router',
      'expo-image',
      'expo-secure-store',
      'expo-font',
      'expo-web-browser',
      [
        'expo-splash-screen',
        {
          image: splash,
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: c.background,
          dark: { image: splash, backgroundColor: '#0F1115' },
        },
      ],
      [
        'expo-notifications',
        {
          icon: notif,
          color: c.primary,
          defaultChannel: 'default',
        },
      ],
    ],
    experiments: { typedRoutes: false },
    extra: {
      client: c.slug,
      siteUrl: c.siteUrl,
      eas: c.easProjectId ? { projectId: c.easProjectId } : undefined,
    },
  };
};
