import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState, IconButton, Loading, Row, Txt } from '@/components/ui';
import { decode } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCategories } from '@/lib/queries';
import { alpha, useTheme } from '@/lib/theme';
import type { Category } from '@/lib/types';

export default function Categories() {
  const { c, radius } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, isLoading, error, refetch } = useCategories();
  const all = data || [];
  const top = all.filter((x) => x.parent === 0);
  const list = top.length ? top : all;
  const children = (id: number) => all.filter((x) => x.parent === id);
  const w = (Math.min(width, 1000) - 16 * 2 - 12) / 2;

  const open = (cat: Category) => router.push({ pathname: '/products', params: { category: String(cat.id), title: cat.name } });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Row style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 8, justifyContent: 'space-between' }}>
        <Txt size={26} weight="heading">
          {t('categories')}
        </Txt>
        <IconButton name="search" onPress={() => router.push('/search')} />
      </Row>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <FlatList
          data={list}
          numColumns={2}
          keyExtractor={(x) => String(x.id)}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 32, paddingTop: 8 }}
          renderItem={({ item }) => {
            const subs = children(item.id);
            return (
              <Pressable onPress={() => open(item)} style={({ pressed }) => ({ width: w, opacity: pressed ? 0.9 : 1 })}>
                <View style={{ height: w * 0.95, borderRadius: radius, overflow: 'hidden', backgroundColor: c.primarySoft }}>
                  {item.image ? <Image source={{ uri: item.image }} style={{ flex: 1 }} contentFit="cover" transition={200} /> : null}
                  <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: alpha('#000000', 0.38) }}>
                    <Txt weight="bold" color="#FFFFFF" numberOfLines={1}>
                      {decode(item.name)}
                    </Txt>
                    <Row gap={4}>
                      <Txt size={12} color={alpha('#FFFFFF', 0.85)}>
                        {t('results', { n: item.count })}
                        {subs.length ? ` · ${subs.length} ${t('categories').toLowerCase()}` : ''}
                      </Txt>
                      <Ionicons name="chevron-forward" size={12} color={alpha('#FFFFFF', 0.85)} />
                    </Row>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
