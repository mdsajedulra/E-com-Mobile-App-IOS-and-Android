import { router } from 'expo-router';
import { useState } from 'react';
import { Screen } from '@/components/layout';
import { Button, Input, Txt } from '@/components/ui';
import { app } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useLocal } from '@/lib/stores';
import type { OrderDetail } from '@/lib/types';

export default function Track() {
  const t = useT();
  const addOrder = useLocal((s) => s.addOrder);
  const [order, setOrder] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const o = (await app('track', { body: { order: order.trim(), contact: contact.trim() } })) as OrderDetail & { key: string };
      addOrder({ id: o.id, number: o.number, status: o.status, status_label: o.status_label, date: o.date, total: o.total, currency: o.currency, items_count: o.items_count, thumb: o.thumb, key: o.key });
      router.replace({ pathname: '/orders/[id]', params: { id: String(o.id), key: o.key } });
    } catch (e: any) {
      setError(e?.message || t('somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('trackOrder')} keyboard>
      <Txt muted style={{ marginBottom: 18 }}>
        {t('trackHint')}
      </Txt>
      <Input label={t('orderNumber')} icon="receipt-outline" value={order} onChangeText={setOrder} keyboardType="number-pad" />
      <Input label={t('phone')} icon="call-outline" value={contact} onChangeText={setContact} keyboardType="phone-pad" error={error} />
      <Button title={t('track')} size="lg" loading={busy} disabled={!order.trim() || !contact.trim()} onPress={submit} />
    </Screen>
  );
}
