// @ts-check
/**
 * White-label app config (plain JavaScript so every Node.js build and EAS CLI can read it).
 * The active client comes from the CLIENT env variable or the .client file written by
 * `npm run use-client -- <slug>`.
 */
const fs = require('fs');
const path = require('path');

function activeClient() {
  const clientFile = path.join(__dirname, '.client');
  const fromFile = fs.existsSync(clientFile) ? fs.readFileSync(clientFile, 'utf8').trim() : '';
  const slug = (process.env.CLIENT || fromFile || 'ceramicbysarah').trim();
  const file = path.join(__dirname, 'clients', slug, 'client.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Client "${slug}" not found. Run: npm run client -- https://your-store.com`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asset(slug, file, fallback) {
  const p = `./clients/${slug}/${file}`;
  return fs.existsSync(path.join(__dirname, p)) ? p : fallback;
}

/** @param {import('expo/config').ConfigContext} ctx @returns {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
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
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
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
      ['expo-notifications', { icon: notif, color: c.primary, defaultChannel: 'default' }],
    ],
    experiments: { typedRoutes: false },
    // Over-the-air updates (EAS Update): ship JS fixes without a new store release.
    runtimeVersion: { policy: 'appVersion' },
    updates: c.easProjectId ? { url: `https://u.expo.dev/${c.easProjectId}` } : undefined,
    extra: {
      client: c.slug,
      siteUrl: c.siteUrl,
      eas: c.easProjectId ? { projectId: c.easProjectId } : undefined,
    },
  };
};
