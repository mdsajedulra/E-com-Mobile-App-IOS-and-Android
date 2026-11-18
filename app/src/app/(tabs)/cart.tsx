import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartLine, Totals } from '@/components/cart';
import { Footer } from '@/components/layout';
import { Button, Card, Divider, Empty, Input, Loading, Row, Txt, toast } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { decode, money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAuth, useCart } from '@/lib/stores';
import { alpha, useTheme } from '@/lib/theme';

export default function CartScreen() {
  const { c, radius } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { cart, load, loading, applyCoupon, removeCoupon } = useCart();
  const features = useConfig((s) => s.config.features);
  const loggedIn = useAuth((s) => !!s.token);
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goCheckout = () => {
    if (!loggedIn && !features.guest_checkout) {
      router.push({ pathname: '/login', params: { next: '/checkout' } });
      return;
    }
    router.push('/checkout');
  };

  const header = (
    <Txt size={26} weight="heading" style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8 }}>
      {t('cart')}
      {cart?.items_count ? (
        <Txt size={16} muted>
          {'  '}
          {cart.items_count === 1 ? t('item') : t('items', { n: cart.items_count })}
        </Txt>
      ) : null}
    </Txt>
  );

  if (!cart) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {header}
        {loading ? <Loading /> : <Empty icon="cloud-offline-outline" title={t('offline')} action={t('retry')} onAction={load} />}
      </View>
    );
  }

  if (!cart.items.length) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {header}
        <Empty icon="bag-handle-outline" title={t('emptyCart')} hint={t('emptyCartHint')} action={t('startShopping')} onAction={() => router.push('/')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { load(); }} tintColor={c.primaryText} />}
      >
        {cart.errors?.map((e, i) => (
          <Row key={i} gap={8} style={{ backgroundColor: alpha(c.danger, 0.1), padding: 12, borderRadius: Math.min(radius, 12), marginBottom: 10 }}>
            <Ionicons name="alert-circle" size={18} color={c.danger} />
            <Txt size={13.5} color={c.danger} style={{ flex: 1 }}>
              {decode(e.message.replace(/<[^>]+>/g, ''))}
            </Txt>
          </Row>
        ))}
        <Card padded={false} style={{ paddingHorizontal: 14 }}>
          {cart.items.map((item, i) => (
            <View key={item.key}>
              {i > 0 ? <Divider style={{ marginVertical: 0 }} /> : null}
              <CartLine item={item} />
            </View>
          ))}
        </Card>

        {features.coupons ? (
          <Card style={{ marginTop: 14 }}>
            {cart.coupons.map((cp) => (
              <Row key={cp.code} style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <Row gap={6}>
                  <Ionicons name="pricetag" size={16} color={c.success} />
                  <Txt weight="bold" color={c.success}>
                    {cp.code.toUpperCase()}
                  </Txt>
                  <Txt muted>-{money(cp.totals.total_discount, cp.totals.currency_minor_unit)}</Txt>
                </Row>
                <Pressable onPress={() => removeCoupon(cp.code).catch((e) => toast(e.message, 'error'))} hitSlop={10}>
                  <Txt size={13} color={c.danger} weight="semibold">
                    {t('remove')}
                  </Txt>
                </Pressable>
              </Row>
            ))}
            <Row gap={10} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Input icon="pricetag-outline" placeholder={t('coupon')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} style={{ marginBottom: 0 }} />
              </View>
              <Button
                title={t('apply')}
                variant="outline"
                loading={applying}
                disabled={!code.trim()}
                style={{ height: 50 }}
                onPress={async () => {
                  setApplying(true);
                  try {
                    await applyCoupon(code.trim());
                    setCode('');
                  } catch (e: any) {
                    toast(e?.message || t('somethingWrong'), 'error');
                  } finally {
                    setApplying(false);
                  }
                }}
              />
            </Row>
          </Card>
        ) : null}

        <Card style={{ marginTop: 14 }}>
          <Totals cart={cart} />
        </Card>
      </ScrollView>
      <Footer tight>
        <Button title={`${t('checkout')} · ${money(cart.totals.total_price, cart.totals.currency_minor_unit)}`} size="lg" icon="lock-closed" onPress={goCheckout} />
      </Footer>
    </View>
  );
}
