import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { useConfig } from '@/lib/config';
import { decode } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/push';
import { useCategories, useProducts } from '@/lib/queries';
import { alpha, useTheme } from '@/lib/theme';
import type { HomeSection } from '@/lib/types';
import { ProductCard, ProductRail, useGridWidth } from './product';
import { Row, SectionHeader, Skeleton, Txt } from './ui';

export function BannerSlider({ items }: { items: { image: string; link: { type: string; value: string } }[] }) {
  const { width } = useWindowDimensions();
  const { c, radius } = useTheme();
  const w = Math.min(width, 1000) - 32;
  const h = Math.round(w / 2);
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % items.length;
        ref.current?.scrollToOffset({ offset: next * (w + 12), animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [items.length, w]);

  return (
    <View style={{ marginTop: 12 }}>
      <FlatList
        ref={ref}
        horizontal
        data={items}
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={w + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (w + 12)))}
        renderItem={({ item }) => (
          <Pressable onPress={() => openLink(item.link.type, item.link.value)}>
            <Image source={{ uri: item.image }} style={{ width: w, height: h, borderRadius: radius, backgroundColor: c.primarySoft }} contentFit="cover" transition={250} />
          </Pressable>
        )}
      />
      {items.length > 1 ? (
        <Row gap={6} style={{ justifyContent: 'center', marginTop: 10 }}>
          {items.map((_, i) => (
            <View key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? c.primaryText : c.border }} />
          ))}
        </Row>
      ) : null}
    </View>
  );
}

/** Shown when the store has no banners yet: a hero card built from the brand. */
export function BrandHero() {
  const { c, radius } = useTheme();
  const t = useT();
  const site = useConfig((s) => s.config.site);
  return (
    <Pressable onPress={() => router.push('/products')} style={{ marginHorizontal: 16, marginTop: 12 }}>
      <View style={{ backgroundColor: c.primary, borderRadius: radius + 4, padding: 22, overflow: 'hidden', minHeight: 150, justifyContent: 'center' }}>
        <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: alpha(c.secondary, 0.35) }} />
        <View style={{ position: 'absolute', right: 30, bottom: -60, width: 120, height: 120, borderRadius: 60, backgroundColor: alpha(c.onPrimary, 0.08) }} />
        <Txt size={13} weight="semibold" color={alpha(c.onPrimary, 0.8)} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {decode(site.name)}
        </Txt>
        <Txt size={24} weight="heading" color={c.onPrimary} style={{ marginTop: 6, maxWidth: '75%', lineHeight: 30 }}>
          {decode(site.tagline) || t('startShopping')}
        </Txt>
        <Row gap={6} style={{ marginTop: 16, backgroundColor: c.secondary, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
          <Txt weight="bold" size={13.5} color={c.onSecondary}>
            {t('startShopping')}
          </Txt>
          <Ionicons name="arrow-forward" size={15} color={c.onSecondary} />
        </Row>
      </View>
    </Pressable>
  );
}

export function CategoryRail({ title }: { title: string }) {
  const { c } = useTheme();
  const t = useT();
  const { data, isLoading } = useCategories();
  const top = (data || []).filter((x) => x.parent === 0 && x.count > 0);
  const list = top.length >= 3 ? top : (data || []).filter((x) => x.count > 0);
  if (!isLoading && !list.length) return null;
  return (
    <View>
      <SectionHeader title={title || t('categories')} action={t('seeAll')} onAction={() => router.push('/categories')} />
      <FlatList
        horizontal
        data={isLoading ? Array.from({ length: 5 }).map((_, i) => ({ id: -i, name: '', image: '', parent: 0, count: 0, slug: '' })) : list}
        keyExtractor={(x) => String(x.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
        renderItem={({ item }) =>
          item.id <= 0 ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Skeleton w={72} h={72} r={36} />
              <Skeleton w={56} h={10} />
            </View>
          ) : (
            <Pressable onPress={() => router.push({ pathname: '/products', params: { category: String(item.id), title: item.name } })} style={{ alignItems: 'center', width: 78 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: c.primarySoft, borderWidth: 2, borderColor: c.surface }}>
                {item.image ? <Image source={{ uri: item.image }} style={{ flex: 1 }} contentFit="cover" /> : null}
              </View>
              <Txt size={12.5} weight="semibold" center numberOfLines={2} style={{ marginTop: 6 }}>
                {decode(item.name)}
              </Txt>
            </Pressable>
          )
        }
      />
    </View>
  );
}

function ProductsSection({ s }: { s: Extract<HomeSection, { type: 'products' }> }) {
  const t = useT();
  const { data, isLoading } = useProducts(s.query);
  const { w } = useGridWidth();
  const items = data?.data || [];
  if (!isLoading && !items.length) return null; // Hide empty sections (e.g. no sale items).
  const more = () => {
    if (s.link.type === 'category') router.push({ pathname: '/products', params: { category: s.link.value, title: s.title } });
    else router.push({ pathname: '/products', params: { query: JSON.stringify({ ...s.query, per_page: undefined }), title: s.title } });
  };
  return (
    <View>
      <SectionHeader title={decode(s.title)} action={t('seeAll')} onAction={more} />
      {s.layout === 'grid' && !isLoading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, rowGap: 20 }}>
          {items.map((p) => (
            <ProductCard key={p.id} p={p} width={w} />
          ))}
        </View>
      ) : (
        <ProductRail products={items} loading={isLoading} />
      )}
    </View>
  );
}

export function NoticeBar({ text }: { text: string }) {
  const { c, radius } = useTheme();
  return (
    <Row gap={10} style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: c.primarySoft, borderRadius: Math.min(radius, 12), padding: 12 }}>
      <Ionicons name="megaphone-outline" size={18} color={c.primaryText} />
      <Txt size={13.5} weight="semibold" color={c.primaryText} style={{ flex: 1 }}>
        {text}
      </Txt>
    </Row>
  );
}

export function HomeSections({ sections }: { sections: HomeSection[] }) {
  const hasBanner = sections.some((s) => s.type === 'banners');
  return (
    <>
      {sections.map((s, i) => {
        switch (s.type) {
          case 'notice':
            return <NoticeBar key={i} text={s.text} />;
          case 'banners':
            return <BannerSlider key={i} items={s.items} />;
          case 'categories':
            return (
              <View key={i}>
                {!hasBanner && i <= 1 ? <BrandHero /> : null}
                <CategoryRail title={s.title} />
              </View>
            );
          case 'products':
            return <ProductsSection key={i} s={s} />;
          default:
            return null;
        }
      })}
    </>
  );
}
