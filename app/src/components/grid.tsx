import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import type { ReactElement } from 'react';
import { useT } from '@/lib/i18n';
import { useInfiniteProducts, type ProductQuery } from '@/lib/queries';
import { useTheme } from '@/lib/theme';
import type { Product } from '@/lib/types';
import { ProductCard, ProductGridSkeleton, useGridWidth } from './product';
import { Empty, ErrorState, Loading, Txt } from './ui';

/** Infinite product grid for any Store API query. */
export function ProductGrid({ query, header, emptyTitle }: { query: ProductQuery; header?: ReactElement | null; emptyTitle?: string }) {
  const { c } = useTheme();
  const t = useT();
  const { cols, w } = useGridWidth();
  const q = useInfiniteProducts(query);
  const items = q.data?.pages.flatMap((p) => p.data) || [];
  const total = q.data?.pages[0]?.total ?? 0;

  const render: ListRenderItem<Product> = ({ item }) => <ProductCard p={item} width={w} />;

  return (
    <FlatList
      key={cols}
      data={items}
      numColumns={cols}
      renderItem={render}
      keyExtractor={(p) => String(p.id)}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
      contentContainerStyle={{ gap: 20, paddingBottom: 40, flexGrow: 1 }}
      onEndReachedThreshold={0.6}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
      refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); }} tintColor={c.primaryText} />}
      ListHeaderComponent={
        <View>
          {header}
          {!q.isLoading && items.length ? (
            <Txt size={13} muted style={{ paddingHorizontal: 16, marginBottom: 4 }}>
              {t('results', { n: total })}
            </Txt>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        q.isLoading ? (
          <ProductGridSkeleton />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : (
          <Empty icon="search-outline" title={emptyTitle || t('noProducts')} hint={t('tryAnother')} />
        )
      }
      ListFooterComponent={q.isFetchingNextPage ? <Loading style={{ padding: 20 }} /> : undefined}
    />
  );
}
