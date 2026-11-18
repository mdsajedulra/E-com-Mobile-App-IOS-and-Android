/* ---------- StoreApp Connector config ---------- */

export type Palette = {
  primary: string;
  onPrimary: string;
  primaryText: string;
  primarySoft: string;
  secondary: string;
  onSecondary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  danger: string;
  warning: string;
  sale: string;
};

export type FontSpec = { family: string; regular: string; semibold: string; bold: string } | null;

export type LinkTarget = { type: 'product' | 'category' | 'url' | 'search' | 'none'; value: string };

export type HomeSection =
  | { type: 'notice'; text: string }
  | { type: 'banners'; items: { image: string; link: LinkTarget }[] }
  | { type: 'categories'; title: string }
  | {
      type: 'products';
      title: string;
      layout: 'carousel' | 'grid';
      query: Record<string, string | number | boolean>;
      link: LinkTarget;
    };

export type Option = { value: string; label: string };

export type CheckoutField = {
  key: string;
  standard: boolean;
  label: string;
  placeholder: string;
  type: string; // text | tel | email | textarea | select | state | country | city
  required: boolean;
  options: Option[] | null;
  default: string;
};

export type AppConfig = {
  version: string;
  site: {
    name: string;
    tagline: string;
    url: string;
    logo: string;
    icon: string;
    currency: { code: string; symbol: string; position: string; decimals: number; thousand: string; decimal: string };
    locale: string;
  };
  theme: {
    colors: Palette;
    dark: Palette;
    mode: 'auto' | 'light' | 'dark';
    radius: number;
    fonts: { heading: FontSpec; body: FontSpec };
  };
  features: {
    registration: boolean;
    guest_checkout: boolean;
    wishlist: boolean;
    reviews: boolean;
    coupons: boolean;
    language: 'en' | 'bn';
  };
  home?: { sections: HomeSection[] };
  contact?: { phone: string; whatsapp: string; email: string; facebook: string; address: string };
  pages?: { key: string; title: string; url: string }[];
  checkout?: {
    fields: CheckoutField[];
    countries: Option[];
    default_country: string;
    states: Record<string, Option[]>;
    order_notes: boolean;
    email_required: boolean;
    cities: Record<string, Option[]>;
    terms_url: string;
  };
  payments?: { id: string; title: string; description: string; icon: string; flow: 'offline' | 'redirect' }[];
};

/* ---------- WooCommerce Store API ---------- */

export type Prices = {
  price: string;
  regular_price: string;
  sale_price: string;
  price_range?: { min_amount: string; max_amount: string } | null;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_prefix: string;
  currency_suffix: string;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
};

export type WCImage = { id: number; src: string; thumbnail: string; alt: string; name: string };

export type Product = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  type: string;
  permalink: string;
  sku: string;
  short_description: string;
  description: string;
  on_sale: boolean;
  prices: Prices;
  average_rating: string;
  review_count: number;
  images: WCImage[];
  categories: { id: number; name: string; slug: string }[];
  attributes: {
    id: number;
    name: string;
    taxonomy: string | null;
    has_variations: boolean;
    terms: { id: number; name: string; slug: string }[];
  }[];
  variations: { id: number; attributes: { name: string; value: string }[] }[];
  has_options: boolean;
  is_purchasable: boolean;
  is_in_stock: boolean;
  is_on_backorder: boolean;
  low_stock_remaining: number | null;
  sold_individually: boolean;
  add_to_cart: { text: string; minimum: number; maximum: number; multiple_of: number };
};

export type Category = { id: number; name: string; slug: string; parent: number; count: number; image: string };

export type CartItem = {
  key: string;
  id: number;
  quantity: number;
  quantity_limits: { minimum: number; maximum: number; multiple_of: number; editable: boolean };
  name: string;
  short_description: string;
  images: WCImage[];
  variation: { attribute: string; value: string }[];
  prices: Prices;
  totals: { line_subtotal: string; line_total: string; currency_minor_unit: number };
};

export type ShippingRate = {
  rate_id: string;
  name: string;
  description: string;
  price: string;
  selected: boolean;
  method_id: string;
  currency_minor_unit: number;
};

export type Address = {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone: string;
};

export type Cart = {
  items: CartItem[];
  items_count: number;
  coupons: { code: string; totals: { total_discount: string; currency_minor_unit: number } }[];
  needs_shipping: boolean;
  needs_payment: boolean;
  payment_methods: string[];
  shipping_rates: { package_id: number; name: string; shipping_rates: ShippingRate[] }[];
  billing_address: Address;
  shipping_address: Address;
  errors: { code: string; message: string }[];
  totals: {
    total_items: string;
    total_shipping: string | null;
    total_discount: string;
    total_fees: string;
    total_tax: string;
    total_price: string;
    currency_minor_unit: number;
    currency_symbol: string;
    currency_prefix: string;
    currency_suffix: string;
  };
  fees: { key: string; name: string; totals: { total: string; currency_minor_unit: number } }[];
};

export type Review = {
  id: number;
  date_created: string;
  review: string;
  rating: number;
  reviewer: string;
  verified: boolean;
};

/* ---------- Account ---------- */

export type User = {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar: string;
  billing: Address;
  shipping: Address;
  orders_count: number;
};

export type OrderSummary = {
  id: number;
  number: string;
  status: string;
  status_label: string;
  date: string;
  total: string;
  currency: string;
  items_count: number;
  thumb: string;
  key?: string;
};

export type OrderDetail = OrderSummary & {
  items: { id: number; product_id: number; name: string; quantity: number; total: string; image: string; meta: { key: string; value: string }[] }[];
  subtotal: string;
  shipping_total: string;
  shipping_method: string;
  discount_total: string;
  tax_total: string;
  fees: { name: string; total: string }[];
  payment_method: string;
  needs_payment: boolean;
  payment_url: string;
  billing: Address;
  shipping: Address;
  customer_note: string;
  notes: { date: string; note: string }[];
  can_cancel: boolean;
  timeline: { steps: { key: string; label: string; done: boolean }[]; cancelled: boolean };
};
