import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { discountPercent, decode, price, priceRange } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCart, useWishlist } from '@/lib/stores';
import { alpha, useTheme } from '@/lib/theme';
import type { Product } from '@/lib/types';
import { Row, Skeleton, Txt, shadow, toast } from './ui';

type CardProduct = Pick<Product, 'id' | 'name' | 'prices' | 'images' | 'on_sale' | 'is_in_stock' | 'average_rating' | 'type' | 'has_options' | 'review_count'>;

export function Stars({ rating, count, size = 12 }: { rating: number; count?: number; size?: number }) {
  return (
    <Row gap={2}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline'} size={size} color="#F5A524" />
      ))}
      {count !== undefined ? (
        <Txt size={size} muted style={{ marginLeft: 3 }}>
          ({count})
        </Txt>
      ) : null}
    </Row>
  );
}

export function PriceTag({ p, size = 15 }: { p: CardProduct; size?: number }) {
  const { c } = useTheme();
  const ranged = !!p.prices.price_range;
  return (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      <Txt size={size} weight="bold" color={c.primaryText}>
        {ranged ? priceRange(p.prices) : price(p.prices)}
      </Txt>
      {p.on_sale && !ranged && p.prices.regular_price !== p.prices.price ? (
        <Txt size={size - 3} muted style={{ textDecorationLine: 'line-through' }}>
          {price(p.prices, 'regular_price')}
        </Txt>
      ) : null}
    </Row>
  );
}

export function HeartButton({ p, size = 18 }: { p: CardProduct; size?: number }) {
  const { c } = useTheme();
  const on = useWishlist((s) => s.items.some((i) => i.id === p.id));
  const toggle = useWishlist((s) => s.toggle);
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        toggle(p as Product);
      }}
      style={[
        { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2, backgroundColor: alpha(c.surface, 0.92), alignItems: 'center', justifyContent: 'center' },
        shadow('#000', 0.08),
      ]}
    >
      <Ionicons name={on ? 'heart' : 'heart-outline'} size={size} color={on ? c.sale : c.text} />
    </Pressable>
  );
}

/** Quick add: simple products go straight to the cart, others open the product page. */
function QuickAdd({ p }: { p: CardProduct }) {
  const { c } = useTheme();
  const t = useT();
  const add = useCart((s) => s.add);
  const [busy, setBusy] = useState(false);
  if (!p.is_in_stock) return null;
  const simple = p.type === 'simple' && !p.has_options;
  return (
    <Pressable
      hitSlop={6}
      onPress={async () => {
        if (!simple) return router.push({ pathname: '/product/[id]', params: { id: String(p.id) } });
        setBusy(true);
        try {
          await add(p.id, 1);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          toast(t('added'));
        } catch (e: any) {
          toast(e?.message || t('somethingWrong'), 'error');
        } finally {
          setBusy(false);
        }
      }}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={c.onPrimary} /> : <Ionicons name={simple ? 'add' : 'options-outline'} size={simple ? 22 : 17} color={c.onPrimary} />}
    </Pressable>
  );
}

export const ProductCard = memo(function ProductCard({ p, width }: { p: CardProduct; width: number }) {
  const { c, radius } = useTheme();
  const t = useT();
  const off = discountPercent(p.prices);
  const img = p.images[0];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(p.id) } })}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={{ width, height: width * 1.08, borderRadius: radius, overflow: 'hidden', backgroundColor: c.primarySoft }}>
        {img ? (
          <Image source={{ uri: img.thumbnail || img.src }} placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} style={{ flex: 1 }} contentFit="cover" transition={200} recyclingKey={String(p.id)} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="image-outline" size={32} color={c.muted} />
          </View>
        )}
        {off > 0 ? (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: c.sale, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Txt size={11} weight="bold" color="#fff" style={{ lineHeight: 14 }}>
              -{off}%
            </Txt>
          </View>
        ) : null}
        {!p.is_in_stock ? (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: alpha('#000000', 0.55), paddingVertical: 6 }}>
            <Txt size={12} weight="semibold" color="#fff" center>
              {t('outOfStock')}
            </Txt>
          </View>
        ) : null}
        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <HeartButton p={p} size={16} />
        </View>
      </View>
      <View style={{ paddingTop: 10, gap: 4 }}>
        <Txt size={14} weight="semibold" numberOfLines={2} style={{ minHeight: 38 }}>
          {decode(p.name)}
        </Txt>
        {Number(p.average_rating) > 0 ? <Stars rating={Number(p.average_rating)} count={p.review_count} size={11} /> : null}
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <PriceTag p={p} size={15} />
          </View>
          <QuickAdd p={p} />
        </Row>
      </View>
    </Pressable>
  );
});

export function ProductRail({ products, loading }: { products: CardProduct[]; loading?: boolean }) {
  const { width } = useWindowDimensions();
  const w = Math.min(190, (width - 16 * 2 - 12) / 2.15);
  if (loading) {
    return (
      <Row gap={12} style={{ paddingHorizontal: 16 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: w, gap: 8 }}>
            <Skeleton h={w * 1.08} />
            <Skeleton h={14} w="80%" />
            <Skeleton h={14} w="40%" />
          </View>
        ))}
      </Row>
    );
  }
  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(p) => String(p.id)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      renderItem={({ item }) => <ProductCard p={item} width={w} />}
    />
  );
}

export function useGridWidth(columns = 2) {
  const { width } = useWindowDimensions();
  const cols = width > 700 ? 3 : columns;
  return { cols, w: (Math.min(width, 1000) - 16 * 2 - 12 * (cols - 1)) / cols };
}

export function ProductGridSkeleton() {
  const { w } = useGridWidth();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: w, gap: 8 }}>
          <Skeleton h={w * 1.08} />
          <Skeleton h={14} w="85%" />
          <Skeleton h={14} w="45%" />
        </View>
      ))}
    </View>
  );
}
