import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { decode, money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCart } from '@/lib/stores';
import { useTheme } from '@/lib/theme';
import type { Cart, CartItem } from '@/lib/types';
import { Divider, Row, Txt, toast } from './ui';

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  busy,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  busy?: boolean;
  compact?: boolean;
}) {
  const { c } = useTheme();
  const s = compact ? 30 : 40;
  const btn = (icon: 'remove' | 'add', next: number, disabled: boolean) => (
    <Pressable
      disabled={disabled || busy}
      onPress={() => onChange(next)}
      hitSlop={6}
      style={({ pressed }) => ({ width: s, height: s, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : pressed ? 0.5 : 1 })}
    >
      <Ionicons name={icon} size={compact ? 16 : 19} color={c.text} />
    </Pressable>
  );
  return (
    <Row gap={0} style={{ borderWidth: 1.5, borderColor: c.border, borderRadius: s / 2, backgroundColor: c.surface }}>
      {btn('remove', value - 1, value <= min)}
      <View style={{ minWidth: compact ? 26 : 34, alignItems: 'center' }}>
        {busy ? <ActivityIndicator size="small" color={c.primaryText} /> : <Txt weight="bold" size={compact ? 14 : 16}>{value}</Txt>}
      </View>
      {btn('add', value + 1, value >= max)}
    </Row>
  );
}

export function CartLine({ item, editable = true }: { item: CartItem; editable?: boolean }) {
  const { c, radius } = useTheme();
  const t = useT();
  const { update, remove, busyKey } = useCart();
  const img = item.images?.[0];
  const busy = busyKey === item.key;
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      toast(e?.message || t('somethingWrong'), 'error');
    }
  };
  return (
    <Row gap={12} style={{ alignItems: 'flex-start', paddingVertical: 12 }}>
      <View style={{ width: 84, height: 84, borderRadius: Math.min(radius, 14), overflow: 'hidden', backgroundColor: c.primarySoft }}>
        {img ? <Image source={{ uri: img.thumbnail || img.src }} style={{ flex: 1 }} contentFit="cover" /> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Txt weight="semibold" numberOfLines={2} style={{ flex: 1 }}>
            {decode(item.name)}
          </Txt>
          {editable ? (
            <Pressable hitSlop={10} onPress={() => run(() => remove(item.key))} disabled={busy}>
              <Ionicons name="trash-outline" size={19} color={c.muted} />
            </Pressable>
          ) : null}
        </Row>
        {item.variation?.length ? (
          <Txt size={12.5} muted numberOfLines={1}>
            {item.variation.map((v) => `${decode(v.attribute)}: ${decode(v.value)}`).join(' · ')}
          </Txt>
        ) : null}
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Txt weight="bold" color={c.primaryText}>
            {money(item.totals.line_total, item.totals.currency_minor_unit)}
          </Txt>
          {editable && item.quantity_limits?.editable !== false ? (
            <QtyStepper
              compact
              value={item.quantity}
              min={1}
              max={item.quantity_limits?.maximum || 999}
              busy={busy}
              onChange={(q) => run(() => update(item.key, q))}
            />
          ) : (
            <Txt muted>× {item.quantity}</Txt>
          )}
        </Row>
      </View>
    </Row>
  );
}

export function Totals({ cart }: { cart: Cart }) {
  const { c } = useTheme();
  const t = useT();
  const m = cart.totals.currency_minor_unit;
  const line = (label: string, value: string, strong?: boolean, color?: string) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
      <Txt muted={!strong} weight={strong ? 'bold' : 'regular'} size={strong ? 17 : 15}>
        {label}
      </Txt>
      <Txt weight={strong ? 'heading' : 'semibold'} size={strong ? 19 : 15} color={color}>
        {value}
      </Txt>
    </Row>
  );
  const shippingKnown = cart.totals.total_shipping !== null && cart.shipping_rates?.some((p) => p.shipping_rates.length);
  return (
    <View>
      {line(t('subtotal'), money(cart.totals.total_items, m))}
      {cart.needs_shipping
        ? line(
            t('shipping'),
            shippingKnown ? (Number(cart.totals.total_shipping) === 0 ? t('freeShipping') : money(cart.totals.total_shipping, m)) : t('calculatedAtCheckout')
          )
        : null}
      {Number(cart.totals.total_discount) > 0 ? line(t('discount'), '-' + money(cart.totals.total_discount, m), false, c.success) : null}
      {cart.fees?.map((f) => line(decode(f.name), money(f.totals.total, m)))}
      {Number(cart.totals.total_tax) > 0 ? line(t('tax'), money(cart.totals.total_tax, m)) : null}
      <Divider />
      {line(t('total'), money(cart.totals.total_price, m), true)}
    </View>
  );
}
