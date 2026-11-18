import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { CartLine, Totals } from '@/components/cart';
import { Screen } from '@/components/layout';
import { Button, Card, Divider, Empty, Input, Loading, Row, SelectField, Txt, toast } from '@/components/ui';
import { store } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { decode, money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { pushToken } from '@/lib/push';
import { useAuth, useCart, useLocal } from '@/lib/stores';
import { alpha, useTheme } from '@/lib/theme';
import type { CheckoutField } from '@/lib/types';

const STANDARD = ['first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'email', 'phone'];

type CheckoutResponse = {
  order_id: number;
  status: string;
  order_key: string;
  order_number?: string;
  payment_result?: { payment_status: string; redirect_url: string; payment_details?: { key: string; value: string }[] };
  totals?: { total_price: string; currency_minor_unit: number };
};

export default function Checkout() {
  const { c, radius } = useTheme();
  const t = useT();
  const config = useConfig((s) => s.config);
  const co = config.checkout;
  const { cart, load, updateCustomer, selectRate } = useCart();
  const user = useAuth((s) => s.user);
  const local = useLocal();

  const country = co?.countries?.length === 1 ? co.countries[0].value : co?.default_country || 'BD';

  const fields: CheckoutField[] = useMemo(
    () => (co?.fields || []).filter((f) => !(f.key === 'country' && (co?.countries?.length || 0) <= 1)),
    [co]
  );

  const initial = useMemo(() => {
    const src: Record<string, string> = {
      ...((cart?.billing_address as any) || {}),
      ...((local.address as any) || {}),
      ...(local.address.extra || {}),
      ...((user?.billing as any) || {}),
    };
    if (user) {
      if (!src.first_name && user.name) src.first_name = user.name;
      if (!src.phone && user.phone) src.phone = user.phone;
      if (!src.email && user.email) src.email = user.email;
    }
    // Single "Name" field: keep the full name in first_name.
    if (!fields.some((f) => f.key === 'last_name') && src.last_name) {
      src.first_name = `${src.first_name || ''} ${src.last_name}`.trim();
      src.last_name = '';
    }
    const v: Record<string, string> = { country: src.country || country };
    for (const f of fields) v[f.key] = String(src[f.key] ?? f.default ?? '');
    if (v.email && /no-email\.invalid$/.test(v.email)) v.email = '';
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState('');
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState('');
  const [updating, setUpdating] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: string, v: string) => {
    setValues((s) => {
      const next = { ...s, [k]: v };
      if (k === 'state') next.city = ''; // City list depends on the district.
      return next;
    });
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  /** Recalculate delivery charge when the location changes. */
  useEffect(() => {
    if (!values.state && !values.city) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setUpdating(true);
      try {
        const addr = { country: values.country || country, state: values.state || '', city: values.city || '', postcode: values.postcode || '' };
        await updateCustomer(addr, addr);
      } catch {
      } finally {
        setUpdating(false);
      }
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.state, values.city, values.postcode, values.country]);

  useEffect(() => {
    if (!cart) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payments = useMemo(() => {
    const all = config.payments || [];
    const allowed = cart?.payment_methods;
    return allowed?.length ? all.filter((p) => allowed.includes(p.id)) : all;
  }, [config.payments, cart?.payment_methods]);

  useEffect(() => {
    if (!payment && payments.length) setPayment(payments[0].id);
  }, [payments, payment]);

  if (!co) return <Screen title={t('checkout')}><Loading /></Screen>;
  if (cart && !cart.items.length) {
    return (
      <Screen title={t('checkout')} scroll={false}>
        <Empty icon="bag-handle-outline" title={t('emptyCart')} action={t('startShopping')} onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] || '').trim();
      const required = f.required || (f.key === 'email' && co.email_required);
      if (required && !v) e[f.key] = t('required', { field: f.label });
      if (f.key === 'phone' && v) {
        const digits = v.replace(/[^0-9+]/g, '');
        const bd = (values.country || country) === 'BD';
        const ok = bd ? /^(\+?880|0)?1[3-9]\d{8}$/.test(digits) : digits.replace('+', '').length >= 7;
        if (!ok) e.phone = t('invalidPhone');
      }
      if (f.key === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) e.email = t('invalidEmail');
    }
    setErrors(e);
    return !Object.keys(e).some((k) => e[k]);
  };

  const place = async () => {
    setFormError('');
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    if (!payment) {
      setFormError(t('paymentMethod'));
      return;
    }
    setPlacing(true);
    const address: Record<string, string> = {};
    for (const k of STANDARD) address[k] = (values[k] || '').trim();
    address.country = values.country || country;
    const extra: Record<string, string> = {};
    for (const f of fields) if (!f.standard) extra[f.key] = (values[f.key] || '').trim();
    const { email, ...shipping } = address;

    try {
      const res = (await store('checkout', {
        body: {
          billing_address: address,
          shipping_address: shipping,
          customer_note: note.trim(),
          payment_method: payment,
          extensions: { storeapp: { extra, push_token: pushToken() || null, platform: Platform.OS } },
        },
      })) as CheckoutResponse;

      local.saveAddress({ ...address, extra });
      const total = cart ? money(cart.totals.total_price, cart.totals.currency_minor_unit) : '';
      local.addOrder({
        id: res.order_id,
        number: res.order_number || String(res.order_id),
        status: res.status,
        status_label: res.status,
        date: new Date().toISOString(),
        total: cart ? String(Number(cart.totals.total_price) / Math.pow(10, cart.totals.currency_minor_unit)) : '0',
        currency: config.site.currency.code,
        items_count: cart?.items_count || 0,
        thumb: cart?.items?.[0]?.images?.[0]?.thumbnail || '',
        key: res.order_key,
      });

      const redirect = res.payment_result?.redirect_url;
      const needsPay = redirect && res.payment_result?.payment_status !== 'success' && !/order-received/.test(redirect);
      useCart.getState().load();
      if (needsPay) {
        router.replace({ pathname: '/pay', params: { url: redirect!, id: String(res.order_id), key: res.order_key, total } });
      } else {
        router.replace({ pathname: '/order-success', params: { id: String(res.order_id), key: res.order_key, total } });
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFormError(e?.message || t('somethingWrong'));
      toast(e?.message || t('somethingWrong'), 'error');
      load();
    } finally {
      setPlacing(false);
    }
  };

  const renderField = (f: CheckoutField) => {
    const label = f.label + (f.required || (f.key === 'email' && co.email_required) ? '' : ` (${t('optional')})`);
    const common = { key: f.key, label, error: errors[f.key] };
    if (f.type === 'state') {
      return (
        <SelectField
          {...common}
          value={values.state || ''}
          placeholder={f.placeholder || f.label}
          options={co.states[values.country || country] || []}
          onChange={(v) => set('state', v)}
        />
      );
    }
    if (f.type === 'city' || (f.key === 'city' && co.cities && Object.keys(co.cities).length)) {
      const list = co.cities?.[values.state || ''] || [];
      if (list.length || !values.state) {
        return (
          <SelectField
            {...common}
            value={values.city || ''}
            placeholder={values.state ? f.placeholder || f.label : t('selectDistrictFirst')}
            options={list}
            disabled={!values.state}
            onChange={(v) => set('city', v)}
          />
        );
      }
    }
    if (f.type === 'country') {
      return <SelectField {...common} value={values.country || country} options={co.countries} onChange={(v) => set('country', v)} />;
    }
    if ((f.type === 'select' || f.type === 'radio') && f.options?.length) {
      return <SelectField {...common} value={values[f.key] || ''} placeholder={f.placeholder || f.label} options={f.options} onChange={(v) => set(f.key, v)} />;
    }
    return (
      <Input
        {...common}
        value={values[f.key] || ''}
        onChangeText={(v) => set(f.key, v)}
        placeholder={f.placeholder}
        multiline={f.type === 'textarea'}
        keyboardType={f.type === 'tel' ? 'phone-pad' : f.type === 'email' ? 'email-address' : f.key === 'postcode' ? 'number-pad' : 'default'}
        autoCapitalize={f.type === 'email' ? 'none' : f.key.includes('name') ? 'words' : 'sentences'}
        autoComplete={f.key === 'phone' ? 'tel' : f.key === 'email' ? 'email' : f.key === 'first_name' ? 'name' : f.key === 'address_1' ? 'street-address' : undefined}
        textContentType={f.key === 'phone' ? 'telephoneNumber' : f.key === 'email' ? 'emailAddress' : undefined}
      />
    );
  };

  const rates = cart?.shipping_rates?.[0];

  return (
    <Screen
      title={t('checkout')}
      keyboard
      footer={
        <Button
          title={placing ? t('placingOrder') : `${t('placeOrder')}${cart ? ` · ${money(cart.totals.total_price, cart.totals.currency_minor_unit)}` : ''}`}
          size="lg"
          icon="checkmark-circle"
          loading={placing}
          disabled={updating || !cart}
          onPress={place}
        />
      }
    >
      <Txt size={17} weight="heading" style={{ marginBottom: 12 }}>
        {t('deliveryDetails')}
      </Txt>
      <Card>{fields.map(renderField)}</Card>

      {cart?.needs_shipping && rates?.shipping_rates?.length ? (
        <>
          <Txt size={17} weight="heading" style={{ marginTop: 22, marginBottom: 12 }}>
            {t('deliveryMethod')}
          </Txt>
          <Card padded={false}>
            {rates.shipping_rates.map((r, i) => (
              <Pressable
                key={r.rate_id}
                onPress={() => selectRate(rates.package_id, r.rate_id).catch((e) => toast(e.message, 'error'))}
                style={{ padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}
              >
                <Row gap={12}>
                  <Ionicons name={r.selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={r.selected ? c.primaryText : c.muted} />
                  <Txt weight="semibold" style={{ flex: 1 }}>
                    {decode(r.name)}
                  </Txt>
                  <Txt weight="bold">{Number(r.price) === 0 ? t('freeShipping') : money(r.price, r.currency_minor_unit)}</Txt>
                </Row>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <Txt size={17} weight="heading" style={{ marginTop: 22, marginBottom: 12 }}>
        {t('paymentMethod')}
      </Txt>
      <Card padded={false}>
        {payments.map((p, i) => (
          <Pressable key={p.id} onPress={() => setPayment(p.id)} style={{ padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
            <Row gap={12} style={{ alignItems: 'flex-start' }}>
              <Ionicons name={payment === p.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={payment === p.id ? c.primaryText : c.muted} />
              <View style={{ flex: 1 }}>
                <Txt weight="semibold">{decode(p.title)}</Txt>
                {payment === p.id && p.description ? (
                  <Txt size={13} muted style={{ marginTop: 3 }}>
                    {decode(p.description)}
                  </Txt>
                ) : null}
              </View>
              <Ionicons name={p.flow === 'offline' ? 'cash-outline' : 'card-outline'} size={20} color={c.muted} />
            </Row>
          </Pressable>
        ))}
      </Card>

      {co.order_notes ? (
        <View style={{ marginTop: 18 }}>
          <Input label={t('orderNote')} value={note} onChangeText={setNote} multiline />
        </View>
      ) : null}

      {cart ? (
        <>
          <Txt size={17} weight="heading" style={{ marginTop: 8, marginBottom: 12 }}>
            {t('orderSummary')}
          </Txt>
          <Card>
            {cart.items.map((it) => (
              <CartLine key={it.key} item={it} editable={false} />
            ))}
            <Divider />
            {updating ? <Loading style={{ padding: 8 }} /> : <Totals cart={cart} />}
          </Card>
        </>
      ) : (
        <Loading />
      )}

      {formError ? (
        <Row gap={8} style={{ marginTop: 14, backgroundColor: alpha(c.danger, 0.1), padding: 14, borderRadius: Math.min(radius, 12), alignItems: 'flex-start' }}>
          <Ionicons name="alert-circle" size={20} color={c.danger} />
          <Txt color={c.danger} style={{ flex: 1 }}>
            {formError}
          </Txt>
        </Row>
      ) : null}
    </Screen>
  );
}
