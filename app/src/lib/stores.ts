import { create } from 'zustand';
import { app, setAuthToken, store } from './api';
import { kv, secure } from './storage';
import type { Address, Cart, OrderSummary, Product, User } from './types';

/* ---------------- Auth ---------------- */

type AuthState = {
  token: string;
  user: User | null;
  ready: boolean;
  restore: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  setUser: (user: User) => void;
  logout: (pushToken?: string) => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: '',
  user: null,
  ready: false,
  async restore() {
    const token = (await secure.get('auth_token')) || '';
    const user = await kv.getJSON<User | null>('auth_user', null);
    setAuthToken(token);
    set({ token, user: token ? user : null, ready: true });
    if (token) {
      // Refresh profile; drop the session if the token was revoked.
      app('me')
        .then((u) => {
          set({ user: u as User });
          kv.setJSON('auth_user', u);
        })
        .catch((e) => {
          if (e?.status === 401) get().logout();
        });
    }
  },
  async setSession(token, user) {
    setAuthToken(token);
    await secure.set('auth_token', token);
    await kv.setJSON('auth_user', user);
    set({ token, user });
    // The cart now belongs to this customer: refresh addresses/prices.
    useCart.getState().load();
  },
  setUser(user) {
    kv.setJSON('auth_user', user);
    set({ user });
  },
  async logout(pushToken) {
    try {
      await app('auth/logout', { body: { push_token: pushToken || '' } });
    } catch {}
    setAuthToken('');
    await secure.del('auth_token');
    await kv.del('auth_user');
    set({ token: '', user: null });
  },
}));

/* ---------------- Cart (WooCommerce Store API) ---------------- */

type CartState = {
  cart: Cart | null;
  loading: boolean;
  busyKey: string;
  load: () => Promise<Cart | null>;
  add: (id: number, quantity: number, variation?: { attribute: string; value: string }[]) => Promise<Cart>;
  update: (key: string, quantity: number) => Promise<void>;
  remove: (key: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: (code: string) => Promise<void>;
  updateCustomer: (billing: Partial<Address>, shipping?: Partial<Address>) => Promise<Cart>;
  selectRate: (packageId: number, rateId: string) => Promise<void>;
  reset: () => void;
};

export const useCart = create<CartState>((set) => ({
  cart: null,
  loading: false,
  busyKey: '',
  async load() {
    set({ loading: true });
    try {
      const cart = (await store('cart')) as Cart;
      set({ cart });
      return cart;
    } catch {
      return null;
    } finally {
      set({ loading: false });
    }
  },
  async add(id, quantity, variation) {
    const cart = (await store('cart/add-item', { body: { id, quantity, variation } })) as Cart;
    set({ cart });
    return cart;
  },
  async update(key, quantity) {
    set({ busyKey: key });
    try {
      const cart = (await store('cart/update-item', { body: { key, quantity } })) as Cart;
      set({ cart });
    } finally {
      set({ busyKey: '' });
    }
  },
  async remove(key) {
    set({ busyKey: key });
    try {
      const cart = (await store('cart/remove-item', { body: { key } })) as Cart;
      set({ cart });
    } finally {
      set({ busyKey: '' });
    }
  },
  async applyCoupon(code) {
    const cart = (await store('cart/apply-coupon', { body: { code } })) as Cart;
    set({ cart });
  },
  async removeCoupon(code) {
    const cart = (await store('cart/remove-coupon', { body: { code } })) as Cart;
    set({ cart });
  },
  async updateCustomer(billing, shipping) {
    const cart = (await store('cart/update-customer', {
      body: { billing_address: billing, shipping_address: shipping || billing },
    })) as Cart;
    set({ cart });
    return cart;
  },
  async selectRate(packageId, rateId) {
    const cart = (await store('cart/select-shipping-rate', { body: { package_id: packageId, rate_id: rateId } })) as Cart;
    set({ cart });
  },
  reset() {
    set({ cart: null });
  },
}));

/* ---------------- Wishlist (on device) ---------------- */

type WishItem = Pick<Product, 'id' | 'name' | 'prices' | 'images' | 'on_sale' | 'is_in_stock' | 'average_rating' | 'type' | 'has_options' | 'review_count'>;

type WishState = {
  items: WishItem[];
  restore: () => Promise<void>;
  toggle: (p: WishItem) => void;
  has: (id: number) => boolean;
};

export const useWishlist = create<WishState>((set, get) => ({
  items: [],
  async restore() {
    set({ items: await kv.getJSON<WishItem[]>('wishlist', []) });
  },
  toggle(p) {
    const exists = get().items.some((i) => i.id === p.id);
    const items = exists
      ? get().items.filter((i) => i.id !== p.id)
      : [
          {
            id: p.id,
            name: p.name,
            prices: p.prices,
            images: p.images.slice(0, 1),
            on_sale: p.on_sale,
            is_in_stock: p.is_in_stock,
            average_rating: p.average_rating,
            review_count: p.review_count,
            type: p.type,
            has_options: p.has_options,
          },
          ...get().items,
        ];
    set({ items });
    kv.setJSON('wishlist', items);
  },
  has: (id) => get().items.some((i) => i.id === id),
}));

/* ---------------- Guest orders + saved address (on device) ---------------- */

type LocalState = {
  orders: OrderSummary[];
  address: Partial<Address> & { extra?: Record<string, string> };
  restore: () => Promise<void>;
  addOrder: (o: OrderSummary) => void;
  saveAddress: (a: LocalState['address']) => void;
};

export const useLocal = create<LocalState>((set, get) => ({
  orders: [],
  address: {},
  async restore() {
    set({
      orders: await kv.getJSON<OrderSummary[]>('guest_orders', []),
      address: await kv.getJSON('last_address', {}),
    });
  },
  addOrder(o) {
    const orders = [o, ...get().orders.filter((x) => x.id !== o.id)].slice(0, 30);
    set({ orders });
    kv.setJSON('guest_orders', orders);
  },
  saveAddress(address) {
    set({ address });
    kv.setJSON('last_address', address);
  },
}));
