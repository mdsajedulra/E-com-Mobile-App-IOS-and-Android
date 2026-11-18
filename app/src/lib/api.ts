import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { kv } from './storage';

export const SITE_URL: string = String(Constants.expoConfig?.extra?.siteUrl || '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  code: string;
  data: unknown;
  constructor(message: string, status: number, code = '', data: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** In-memory copies of the tokens (persisted in secure storage by the stores). */
const session = { auth: '', cart: '' };

export function setAuthToken(t: string) {
  session.auth = t;
}
export function setCartToken(t: string) {
  session.cart = t;
  kv.set('cart_token', t);
}
export function getCartToken() {
  return session.cart;
}
export async function restoreCartToken() {
  session.cart = (await kv.get('cart_token')) || '';
}

type Opts = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Return headers too (pagination). */
  withHeaders?: boolean;
  signal?: AbortSignal;
};

export function buildQuery(q?: Opts['query']) {
  if (!q) return '';
  const parts = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').trim();
}

export async function request<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const url = `${SITE_URL}/wp-json/${path.replace(/^\//, '')}${buildQuery(opts.query)}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-StoreApp': `1; ${Platform.OS}`,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.auth) headers['X-StoreApp-Token'] = session.auth;
  if (session.cart && path.startsWith('wc/store')) headers['Cart-Token'] = session.cart;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError('network', 0, 'network');
  }

  const newCart = res.headers.get('Cart-Token');
  if (newCart && newCart !== session.cart) setCartToken(newCart);

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    let message = json?.message ? stripHtml(String(json.message)) : `Error ${res.status}`;
    // Cart validation errors carry several messages.
    const errs = json?.data?.errors;
    if (errs && typeof errs === 'object') {
      const all = Object.values(errs).flat().map((m) => stripHtml(String(m)));
      if (all.length) message = all.join('\n');
    }
    throw new ApiError(message, res.status, json?.code || '', json?.data ?? null);
  }
  if (opts.withHeaders) {
    return {
      data: json,
      total: Number(res.headers.get('X-WP-Total') || 0),
      totalPages: Number(res.headers.get('X-WP-TotalPages') || 1),
    } as T;
  }
  return json as T;
}

export const store = (path: string, opts?: Opts) => request(`wc/store/v1/${path}`, opts);
export const app = (path: string, opts?: Opts) => request(`storeapp/v1/${path}`, opts);
