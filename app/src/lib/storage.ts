import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Plain key/value (AsyncStorage). */
export const kv = {
  async get(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  async del(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
  async getJSON<T>(key: string, fallback: T): Promise<T> {
    const raw = await kv.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: unknown) {
    return kv.set(key, JSON.stringify(value));
  },
};

/** Secrets (login token) in the Keychain / Keystore. */
export const secure = {
  async get(key: string) {
    if (Platform.OS === 'web') return kv.get(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return kv.set(key, value);
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async del(key: string) {
    if (Platform.OS === 'web') return kv.del(key);
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};
