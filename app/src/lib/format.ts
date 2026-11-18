import { cfg } from './config';
import type { Prices } from './types';

function group(intPart: string, sep: string, indian: boolean) {
  if (!indian) return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  // South Asian grouping: 12,34,567
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  return rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, sep) + sep + last3 : last3;
}

/**
 * Format an amount. `minor` = Store API minor units (e.g. "12500" with minor unit 2 = 125.00).
 */
export function money(amount: string | number | null | undefined, minorUnit?: number | null) {
  const c = cfg().site.currency;
  let n = Number(amount || 0);
  if (minorUnit !== undefined && minorUnit !== null) n = n / Math.pow(10, minorUnit);
  const decimals = c.decimals;
  const fixed = Math.abs(n).toFixed(decimals);
  const [i, d] = fixed.split('.');
  const indian = ['BDT', 'INR', 'NPR', 'PKR', 'LKR'].includes(c.code);
  const num = group(i, c.thousand || ',', indian) + (d ? (c.decimal || '.') + d : '');
  const sym = (c.symbol || '').trim();
  const sign = n < 0 ? '-' : '';
  switch (c.position) {
    case 'right':
      return `${sign}${num}${sym}`;
    case 'right_space':
      return `${sign}${num} ${sym}`;
    case 'left_space':
      return `${sign}${sym} ${num}`;
    default:
      return `${sign}${sym}${num}`;
  }
}

export const price = (p: Prices, key: 'price' | 'regular_price' | 'sale_price' = 'price') => money(p[key], p.currency_minor_unit);

export function priceRange(p: Prices) {
  if (p.price_range && p.price_range.min_amount !== p.price_range.max_amount) {
    return `${money(p.price_range.min_amount, p.currency_minor_unit)} – ${money(p.price_range.max_amount, p.currency_minor_unit)}`;
  }
  return price(p);
}

export function discountPercent(p: Prices) {
  const r = Number(p.regular_price);
  const s = Number(p.sale_price);
  if (!r || !s || s >= r) return 0;
  return Math.round(((r - s) / r) * 100);
}

const entities: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…', '&#8211;': '–', '&#8217;': '’', '&#8220;': '“', '&#8221;': '”' };

export function decode(s: string) {
  return (s || '').replace(/&[#a-z0-9]+;/gi, (m) => entities[m] ?? (m.startsWith('&#') ? String.fromCharCode(parseInt(m.replace(/[&#;x]/gi, ''), m.includes('x') ? 16 : 10)) : m));
}

/** HTML description → readable plain text with bullets and paragraphs. */
export function htmlToText(html: string) {
  return decode(
    (html || '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '\n•  ')
      .replace(/<\/\s*(p|div|h[1-6]|ul|ol|tr)\s*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function dateShort(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
