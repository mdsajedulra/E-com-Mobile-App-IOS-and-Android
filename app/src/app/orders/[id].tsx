import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Screen } from '@/components/layout';
import { Button, Card, Divider, ErrorState, Loading, Row, Txt, toast } from '@/components/ui';
import { app } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { dateShort, decode, money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useOrder } from '@/lib/queries';
import { alpha, useTheme } from '@/lib/theme';
import { statusColor } from '@/lib/status';

export default function OrderScreen() {
  const { id, key } = useLocalSearchParams<{ id: string; key?: string }>();
  const { c, radius } = useTheme();
  const t = useT();
  const qc = useQueryClient();
  const contact = useConfig((s) => s.config.contact);
  const { data: o, isLoading, error, refetch } = useOrder(id, key || undefined);
  const [cancelling, setCancelling] = useState(false);

  if (isLoading) return <Screen title={`${t('order')} #${id}`}><Loading /></Screen>;
  if (error || !o) return <Screen title={`${t('order')} #${id}`} scroll={false}><ErrorState error={error} onRetry={refetch} /></Screen>;

  const color = statusColor(o.status, c);
  const line = (label: string, value: string, bold?: boolean) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <Txt muted={!bold} weight={bold ? 'bold' : 'regular'}>
        {label}
      </Txt>
      <Txt weight={bold ? 'heading' : 'semibold'} size={bold ? 18 : 15}>
        {value}
      </Txt>
    </Row>
  );
  const addr = o.billing;
  const wa = contact?.whatsapp?.replace(/[^0-9]/g, '');

  return (
    <Screen title={`${t('order')} #${o.number}`}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt muted>{dateShort(o.date)}</Txt>
          <View style={{ backgroundColor: alpha(color, 0.12), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Txt size={13} weight="bold" color={color}>
              {o.status_label}
            </Txt>
          </View>
        </Row>
        {!o.timeline.cancelled ? (
          <View style={{ marginTop: 18 }}>
            {o.timeline.steps.map((s, i) => (
              <Row key={s.key} gap={12} style={{ alignItems: 'flex-start' }}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: s.done ? c.primary : c.surface,
                      borderWidth: 2,
                      borderColor: s.done ? c.primary : c.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {s.done ? <Ionicons name="checkmark" size={14} color={c.onPrimary} /> : null}
                  </View>
                  {i < o.timeline.steps.length - 1 ? <View style={{ width: 2, height: 22, backgroundColor: o.timeline.steps[i + 1].done ? c.primary : c.border }} /> : null}
                </View>
                <Txt weight={s.done ? 'bold' : 'regular'} muted={!s.done} style={{ marginTop: 2 }}>
                  {s.label}
                </Txt>
              </Row>
            ))}
          </View>
        ) : null}
      </Card>

      {o.notes.length ? (
        <Card style={{ marginTop: 14 }}>
          {o.notes.map((n, i) => (
            <View key={i} style={{ paddingVertical: 6 }}>
              <Txt size={12} muted>
                {dateShort(n.date)}
              </Txt>
              <Txt>{n.note}</Txt>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={{ marginTop: 14 }}>
        {o.items.map((it) => (
          <Row key={it.id} gap={12} style={{ paddingVertical: 8 }}>
            <View style={{ width: 54, height: 54, borderRadius: Math.min(radius, 10), overflow: 'hidden', backgroundColor: c.primarySoft }}>
              {it.image ? <Image source={{ uri: it.image }} style={{ flex: 1 }} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" numberOfLines={2} onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(it.product_id) } })}>
                {decode(it.name)}
              </Txt>
              {it.meta.length ? (
                <Txt size={12.5} muted>
                  {it.meta.map((m) => `${m.key}: ${m.value}`).join(' · ')}
                </Txt>
              ) : null}
              <Txt size={13} muted>
                × {it.quantity}
              </Txt>
            </View>
            <Txt weight="bold">{money(it.total)}</Txt>
          </Row>
        ))}
        <Divider />
        {line(t('subtotal'), money(o.subtotal))}
        {Number(o.shipping_total) > 0 || o.shipping_method ? line(o.shipping_method || t('shipping'), Number(o.shipping_total) ? money(o.shipping_total) : t('freeShipping')) : null}
        {Number(o.discount_total) > 0 ? line(t('discount'), '-' + money(o.discount_total)) : null}
        {o.fees.map((f, i) => (
          <View key={i}>{line(decode(f.name), money(f.total))}</View>
        ))}
        {Number(o.tax_total) > 0 ? line(t('tax'), money(o.tax_total)) : null}
        <Divider />
        {line(t('total'), money(o.total), true)}
        <Txt size={13} muted style={{ marginTop: 6 }}>
          {o.payment_method}
        </Txt>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Txt weight="bold" style={{ marginBottom: 6 }}>
          {t('billingAddress')}
        </Txt>
        <Txt>{[addr.first_name, addr.last_name].filter(Boolean).join(' ')}</Txt>
        <Txt muted>{[addr.address_1, addr.address_2, addr.city, addr.state].filter(Boolean).join(', ')}</Txt>
        {addr.phone ? <Txt muted>{addr.phone}</Txt> : null}
        {o.customer_note ? (
          <Txt muted style={{ marginTop: 8, fontStyle: 'italic' }}>
            “{o.customer_note}”
          </Txt>
        ) : null}
      </Card>

      <View style={{ gap: 10, marginTop: 18 }}>
        {o.needs_payment && o.payment_url ? (
          <Button title={t('payNow')} icon="card-outline" onPress={() => router.push({ pathname: '/pay', params: { url: o.payment_url, id: String(o.id), key: key || '' } })} />
        ) : null}
        {wa ? (
          <Button
            title={t('whatsapp')}
            variant="outline"
            icon="logo-whatsapp"
            onPress={() => Linking.openURL(`https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}?text=${encodeURIComponent(`${t('order')} #${o.number}`)}`)}
          />
        ) : null}
        {o.can_cancel ? (
          <Button
            title={t('cancelOrder')}
            variant="ghost"
            loading={cancelling}
            onPress={() =>
              Alert.alert(t('cancelOrder'), t('cancelConfirm'), [
                { text: t('no'), style: 'cancel' },
                {
                  text: t('yes'),
                  style: 'destructive',
                  onPress: async () => {
                    setCancelling(true);
                    try {
                      await app(`orders/${o.id}/cancel`, { body: {} });
                      await refetch();
                      qc.invalidateQueries({ queryKey: ['orders'] });
                    } catch (e: any) {
                      toast(e?.message || t('somethingWrong'), 'error');
                    } finally {
                      setCancelling(false);
                    }
                  },
                },
              ])
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}
