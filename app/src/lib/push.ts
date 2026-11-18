import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { app } from './api';
import { kv } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedToken = '';

export function pushToken() {
  return cachedToken;
}

export async function permissionStatus() {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.status;
  } catch {
    return 'undetermined';
  }
}

/** Ask for permission (if needed) and register the device with the store. */
export async function registerPush(ask: boolean) {
  try {
    if (!Device.isDevice || Platform.OS === 'web') return '';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Orders & offers',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return '';
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return '';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    cachedToken = token;
    await kv.set('push_token', token);
    await app('push/register', { body: { token, platform: Platform.OS } }).catch(() => {});
    return token;
  } catch {
    return '';
  }
}

export async function restorePushToken() {
  cachedToken = (await kv.get('push_token')) || '';
}

/** Where a tapped notification / banner / deep link should go. */
export function openLink(type?: string, value?: string | number, extra?: Record<string, unknown>) {
  const v = value === undefined || value === null ? '' : String(value);
  switch (type) {
    case 'product':
      if (v) router.push({ pathname: '/product/[id]', params: { id: v } });
      break;
    case 'category':
      if (v) router.push({ pathname: '/products', params: { category: v } });
      break;
    case 'search':
      if (v.startsWith('{')) router.push({ pathname: '/products', params: { query: v } });
      else if (v) router.push({ pathname: '/products', params: { search: v } });
      break;
    case 'order':
      if (v) router.push({ pathname: '/orders/[id]', params: { id: v, key: String(extra?.key || '') } });
      break;
    case 'url':
      if (/^https?:\/\//.test(v)) WebBrowser.openBrowserAsync(v);
      break;
    default:
      break;
  }
}

export function listenToNotificationTaps() {
  const handle = (r: Notifications.NotificationResponse | null) => {
    const d = (r?.notification.request.content.data || {}) as Record<string, any>;
    if (d.type) openLink(d.type, d.id ?? d.value, d);
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
