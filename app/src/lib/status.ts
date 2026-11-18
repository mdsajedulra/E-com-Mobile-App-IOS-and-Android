import type { Palette } from './types';

export function statusColor(status: string, c: Palette) {
  if (status === 'completed') return c.success;
  if (['cancelled', 'failed', 'refunded'].includes(status)) return c.danger;
  if (status === 'processing') return c.primaryText;
  return c.warning;
}
