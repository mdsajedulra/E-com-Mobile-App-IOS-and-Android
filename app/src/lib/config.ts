import { create } from 'zustand';
import snapshot from '@/generated/snapshot.json';
import { app } from './api';
import { kv } from './storage';
import type { AppConfig } from './types';

const DEFAULT: AppConfig = {
  version: '0',
  site: {
    name: 'Store',
    tagline: '',
    url: '',
    logo: '',
    icon: '',
    currency: { code: 'USD', symbol: '$', position: 'left', decimals: 2, thousand: ',', decimal: '.' },
    locale: 'en_US',
  },
  theme: {
    colors: {
      primary: '#111827',
      onPrimary: '#FFFFFF',
      primaryText: '#111827',
      primarySoft: '#EEF0F3',
      secondary: '#6B7280',
      onSecondary: '#FFFFFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: '#111111',
      muted: '#6B7280',
      border: '#E5E7EB',
      success: '#16A34A',
      danger: '#DC2626',
      warning: '#D97706',
      sale: '#DC2626',
    },
    dark: {
      primary: '#F9FAFB',
      onPrimary: '#111111',
      primaryText: '#F9FAFB',
      primarySoft: '#1F232B',
      secondary: '#9CA3AF',
      onSecondary: '#111111',
      background: '#0F1115',
      surface: '#181B21',
      text: '#F3F4F6',
      muted: '#9CA3AF',
      border: '#2A2F38',
      success: '#22C55E',
      danger: '#F87171',
      warning: '#FBBF24',
      sale: '#F87171',
    },
    mode: 'auto',
    radius: 14,
    fonts: { heading: null, body: null },
  },
  features: { registration: true, guest_checkout: true, wishlist: true, reviews: true, coupons: true, language: 'en' },
};

function merge(base: AppConfig, next: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...next,
    site: { ...base.site, ...(next.site || {}) },
    theme: {
      ...base.theme,
      ...(next.theme || {}),
      colors: { ...base.theme.colors, ...(next.theme?.colors || {}) },
      dark: { ...base.theme.dark, ...(next.theme?.dark || {}) },
      fonts: { ...base.theme.fonts, ...(next.theme?.fonts || {}) },
    },
    features: { ...base.features, ...(next.features || {}) },
  } as AppConfig;
}

type State = {
  config: AppConfig;
  /** true once a live (or cached live) config is available. */
  live: boolean;
  error: string;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
};

const CACHE_KEY = 'app_config_v1';

export const useConfig = create<State>((set, get) => ({
  config: merge(DEFAULT, snapshot as Partial<AppConfig>),
  live: false,
  error: '',
  async hydrate() {
    const cached = await kv.getJSON<AppConfig | null>(CACHE_KEY, null);
    if (cached?.site) {
      set({ config: merge(DEFAULT, cached), live: true });
    }
  },
  async refresh() {
    try {
      const fresh = await app('config');
      const cfg = merge(DEFAULT, fresh as AppConfig);
      set({ config: cfg, live: true, error: '' });
      kv.setJSON(CACHE_KEY, cfg);
    } catch (e: any) {
      set({ error: e?.message || 'network' });
      if (!get().live) throw e;
    }
  },
}));

export const cfg = () => useConfig.getState().config;
