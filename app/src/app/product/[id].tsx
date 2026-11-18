import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Footer, Header } from '@/components/layout';
import { HeartButton, ProductRail, Stars } from '@/components/product';
import { QtyStepper } from '@/components/cart';
import { Button, Card, ErrorState, IconButton, Loading, Row, Txt, toast } from '@/components/ui';
import { store } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { dateShort, decode, discountPercent, htmlToText, price, priceRange } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useProduct, useProducts, useReviews } from '@/lib/queries';
import { useCart } from '@/lib/stores';
import { alpha, useTheme } from '@/lib/theme';
import type { Product } from '@/lib/types';

function Gallery({ images, height }: { images: Product['images']; height: number }) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const [i, setI] = useState(0);
  if (!images.length) {
    return (
      <View style={{ width, height, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="image-outline" size={48} color={c.muted} />
      </View>
    );
  }
  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        data={images}
        keyExtractor={(im) => String(im.id) + im.src}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <Image source={{ uri: item.src }} placeholder={{ uri: item.thumbnail }} style={{ width, height, backgroundColor: c.primarySoft }} contentFit="cover" transition={200} />}
      />
      {images.length > 1 ? (
        <Row gap={6} style={{ position: 'absolute', bottom: 28, alignSelf: 'center' }}>
          {images.map((_, k) => (
            <View key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? '#FFFFFF' : alpha('#FFFFFF', 0.55) }} />
          ))}
        </Row>
      ) : null}
    </View>
  );
}

const norm = (s: string) => decode(s || '').trim().toLowerCase();

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, radius } = useTheme();
  const t = useT();
  const { width } = useWindowDimensions();
  const features = useConfig((s) => s.config.features);
  const { data: p, isLoading, error, refetch } = useProduct(id);
  const add = useCart((s) => s.add);
  const cartCount = useCart((s) => s.cart?.items_count || 0);
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<'' | 'add' | 'buy'>('');
  const [showAll, setShowAll] = useState(false);

  const varAttrs = useMemo(() => (p?.attributes || []).filter((a) => a.has_variations), [p]);

  const variation = useMemo(() => {
    if (!p || !varAttrs.length) return null;
    if (varAttrs.some((a) => !sel[a.name])) return null;
    return (
      p.variations.find((v) =>
        v.attributes.every((va) => {
          const attr = varAttrs.find((a) => norm(a.name) === norm(va.name) || norm(a.taxonomy || '') === norm(va.name));
          if (!attr) return true;
          const chosen = attr.terms.find((tm) => tm.slug === sel[attr.name]);
          return !va.value || va.value === sel[attr.name] || norm(va.value) === norm(chosen?.name || '');
        })
      ) || null
    );
  }, [p, varAttrs, sel]);

  const { data: vp } = useQuery({
    queryKey: ['product', String(variation?.id)],
    queryFn: async () => (await store(`products/${variation!.id}`)) as Product,
    enabled: !!variation,
  });

  const related = useProducts({ category: p?.categories?.[0]?.id, per_page: 10, exclude: p?.id }, !!p?.categories?.length);
  const reviews = useReviews(p?.id || 0, !!p && features.reviews && p.review_count > 0);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Header />
        <Loading />
      </View>
    );
  }
  if (error || !p) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Header />
        <ErrorState error={error} onRetry={refetch} />
      </View>
    );
  }

  const shown = vp || p;
  const images = vp?.images?.length ? [...vp.images, ...p.images.filter((im) => im.id !== vp.images[0]?.id)] : p.images;
  const off = discountPercent(shown.prices);
  const needsChoice = varAttrs.length > 0 && !variation;
  const inStock = variation ? (vp ? vp.is_in_stock : true) : p.is_in_stock;
  const purchasable = p.is_purchasable && inStock && (p.type === 'simple' || p.type === 'variable');
  const maxQty = shown.add_to_cart?.maximum || 99;
  const desc = htmlToText(p.description || p.short_description);
  const short = htmlToText(p.short_description);

  const doAdd = async (mode: 'add' | 'buy') => {
    if (needsChoice) {
      toast(t('selectOptions'), 'error');
      return;
    }
    setAdding(mode);
    try {
      const variationPayload = variation
        ? varAttrs.map((a) => ({ attribute: a.taxonomy || a.name, value: sel[a.name] }))
        : undefined;
      await add(variation ? variation.id : p.id, qty, variationPayload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (mode === 'buy') router.push('/checkout');
      else toast(t('added'));
    } catch (e: any) {
      toast(e?.message || t('somethingWrong'), 'error');
    } finally {
      setAdding('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header
        transparent
        right={
          <Row gap={8}>
            <IconButton name="share-outline" filled onPress={() => Share.share({ message: `${decode(p.name)}\n${p.permalink}`, url: p.permalink })} />
            <IconButton name="bag-handle-outline" filled badge={cartCount} onPress={() => router.push('/cart')} />
          </Row>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Gallery images={images} height={Math.min(width * 1.05, 620)} />
        <View style={{ marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: c.background, padding: 18 }}>
          <Row style={{ alignItems: 'flex-start' }} gap={12}>
            <View style={{ flex: 1, gap: 6 }}>
              {p.categories?.[0] ? (
                <Txt size={12.5} weight="semibold" color={c.primaryText} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {decode(p.categories[0].name)}
                </Txt>
              ) : null}
              <Txt size={22} weight="heading" style={{ lineHeight: 29 }}>
                {decode(p.name)}
              </Txt>
            </View>
            {features.wishlist ? <HeartButton p={p} size={20} /> : null}
          </Row>

          {Number(p.average_rating) > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Stars rating={Number(p.average_rating)} count={p.review_count} size={14} />
            </View>
          ) : null}

          <Row gap={10} style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <Txt size={26} weight="heading" color={c.primaryText}>
              {variation || !p.prices.price_range ? price(shown.prices) : priceRange(p.prices)}
            </Txt>
            {shown.on_sale && shown.prices.regular_price !== shown.prices.price ? (
              <Txt size={16} muted style={{ textDecorationLine: 'line-through' }}>
                {price(shown.prices, 'regular_price')}
              </Txt>
            ) : null}
            {off > 0 ? (
              <View style={{ backgroundColor: alpha(c.sale, 0.12), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Txt size={12.5} weight="bold" color={c.sale}>
                  {t('off', { n: off })}
                </Txt>
              </View>
            ) : null}
          </Row>

          <Row gap={6} style={{ marginTop: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: inStock ? c.success : c.danger }} />
            <Txt size={13.5} weight="semibold" color={inStock ? c.success : c.danger}>
              {inStock
                ? shown.low_stock_remaining
                  ? t('onlyLeft', { n: shown.low_stock_remaining })
                  : t('inStock')
                : t('outOfStock')}
            </Txt>
          </Row>

          {short && short !== desc ? (
            <Txt muted style={{ marginTop: 14 }}>
              {short}
            </Txt>
          ) : null}

          {varAttrs.map((a) => (
            <View key={a.id + a.name} style={{ marginTop: 20 }}>
              <Txt weight="bold" style={{ marginBottom: 10 }}>
                {decode(a.name)}
                {sel[a.name] ? <Txt muted>{`  ${decode(a.terms.find((tm) => tm.slug === sel[a.name])?.name || '')}`}</Txt> : null}
              </Txt>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {a.terms.map((tm) => {
                  const on = sel[a.name] === tm.slug;
                  return (
                    <Pressable
                      key={tm.id + tm.slug}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSel((s) => ({ ...s, [a.name]: on ? '' : tm.slug }));
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: Math.min(radius, 12),
                        borderWidth: 1.5,
                        borderColor: on ? c.primaryText : c.border,
                        backgroundColor: on ? c.primarySoft : c.surface,
                      }}
                    >
                      <Txt weight={on ? 'bold' : 'semibold'} color={on ? c.primaryText : c.text}>
                        {decode(tm.name)}
                      </Txt>
                    </Pressable>
                  );
                })}
              </Row>
            </View>
          ))}

          {purchasable && !p.sold_individually ? (
            <Row style={{ marginTop: 22, justifyContent: 'space-between' }}>
              <Txt weight="bold">{t('quantity')}</Txt>
              <QtyStepper value={qty} min={1} max={maxQty > 0 ? maxQty : 99} onChange={setQty} />
            </Row>
          ) : null}

          {desc ? (
            <Card style={{ marginTop: 22 }}>
              <Txt weight="bold" size={16} style={{ marginBottom: 8 }}>
                {t('description')}
              </Txt>
              <Txt style={{ lineHeight: 23 }} numberOfLines={showAll ? undefined : 6}>
                {desc}
              </Txt>
              {desc.length > 280 ? (
                <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8} style={{ marginTop: 8 }}>
                  <Txt weight="bold" color={c.primaryText}>
                    {showAll ? '−' : '+'} {t('seeAll')}
                  </Txt>
                </Pressable>
              ) : null}
            </Card>
          ) : null}

          {features.reviews && p.review_count > 0 ? (
            <Card style={{ marginTop: 14 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Txt weight="bold" size={16}>
                  {t('reviews')} ({p.review_count})
                </Txt>
                <Stars rating={Number(p.average_rating)} size={14} />
              </Row>
              {(reviews.data || []).slice(0, 5).map((r) => (
                <View key={r.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt weight="semibold">{r.reviewer}</Txt>
                    <Txt size={12} muted>
                      {dateShort(r.date_created)}
                    </Txt>
                  </Row>
                  <Stars rating={r.rating} size={11} />
                  <Txt style={{ marginTop: 4 }}>{htmlToText(r.review)}</Txt>
                </View>
              ))}
            </Card>
          ) : null}
        </View>

        {related.data?.data?.length ? (
          <View>
            <Txt size={19} weight="heading" style={{ paddingHorizontal: 18, marginBottom: 12, marginTop: 4 }}>
              {t('related')}
            </Txt>
            <ProductRail products={related.data.data.filter((x) => x.id !== p.id)} />
          </View>
        ) : null}
      </ScrollView>

      <Footer>
        {purchasable || needsChoice ? (
          <Row gap={10}>
            <Button title={t('addToCart')} variant="outline" icon="bag-add-outline" flex loading={adding === 'add'} onPress={() => doAdd('add')} />
            <Button title={t('buyNow')} flex loading={adding === 'buy'} onPress={() => doAdd('buy')} />
          </Row>
        ) : (
          <Button title={t('outOfStock')} disabled />
        )}
      </Footer>
    </View>
  );
}
