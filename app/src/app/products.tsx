import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { ProductGrid } from '@/components/grid';
import { Header } from '@/components/layout';
import { IconButton, Row, Sheet, Txt } from '@/components/ui';
import { decode } from '@/lib/format';
import { useT, type TKey } from '@/lib/i18n';
import { useCategories } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

const SORTS: { key: string; label: TKey; q: Record<string, string> }[] = [
  { key: 'latest', label: 'sortLatest', q: { orderby: 'date', order: 'desc' } },
  { key: 'popular', label: 'sortPopular', q: { orderby: 'popularity', order: 'desc' } },
  { key: 'low', label: 'sortPriceLow', q: { orderby: 'price', order: 'asc' } },
  { key: 'high', label: 'sortPriceHigh', q: { orderby: 'price', order: 'desc' } },
  { key: 'rating', label: 'sortRating', q: { orderby: 'rating', order: 'desc' } },
];

export default function Products() {
  const params = useLocalSearchParams<{ category?: string; search?: string; query?: string; title?: string }>();
  const { c, radius } = useTheme();
  const t = useT();
  const cats = useCategories();
  const [sort, setSort] = useState('');
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string>('');

  const base = useMemo(() => {
    let q: Record<string, string | number | boolean> = {};
    if (params.query) {
      try {
        q = JSON.parse(params.query);
      } catch {}
    }
    if (params.category) q.category = params.category;
    if (params.search) q.search = params.search;
    delete q.per_page;
    return q;
  }, [params.query, params.category, params.search]);

  const category = cats.data?.find((x) => String(x.id) === String(params.category));
  const children = (cats.data || []).filter((x) => params.category && String(x.parent) === String(params.category) && x.count > 0);
  const title = decode(params.title || category?.name || (params.search ? `“${params.search}”` : t('shop')));

  const query = { ...base, ...(sub ? { category: sub } : {}), ...(SORTS.find((s) => s.key === sort)?.q || {}) };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header
        title={title}
        right={
          <Row gap={0}>
            <IconButton name="search" onPress={() => router.push('/search')} />
            <IconButton name="swap-vertical" onPress={() => setOpen(true)} />
          </Row>
        }
      />
      <ProductGrid
        query={query}
        header={
          children.length ? (
            <FlatList
              horizontal
              data={[{ id: 0, name: t('seeAll') }, ...children]}
              keyExtractor={(x) => String(x.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 14 }}
              renderItem={({ item }) => {
                const on = (item.id === 0 && !sub) || String(item.id) === sub;
                return (
                  <Pressable
                    onPress={() => setSub(item.id === 0 ? '' : String(item.id))}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: on ? c.primary : c.surface,
                      borderWidth: 1,
                      borderColor: on ? c.primary : c.border,
                    }}
                  >
                    <Txt size={13.5} weight="semibold" color={on ? c.onPrimary : c.text}>
                      {decode(item.name)}
                    </Txt>
                  </Pressable>
                );
              }}
            />
          ) : null
        }
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('sortBy')}>
        {SORTS.map((s) => {
          const on = (sort || 'latest') === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                setSort(s.key);
                setOpen(false);
              }}
              style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderRadius: radius }}
            >
              <Txt style={{ flex: 1 }} weight={on ? 'bold' : 'regular'} color={on ? c.primaryText : undefined}>
                {t(s.label)}
              </Txt>
              {on ? <Ionicons name="checkmark-circle" size={22} color={c.primaryText} /> : null}
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}
