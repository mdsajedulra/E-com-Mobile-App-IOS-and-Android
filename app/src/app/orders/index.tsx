import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { Header } from '@/components/layout';
import { Card, Empty, ErrorState, Loading, Row, Txt } from '@/components/ui';
import { dateShort, money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useOrders } from '@/lib/queries';
import { useAuth, useLocal } from '@/lib/stores';
import { alpha, useTheme } from '@/lib/theme';
import { statusColor } from '@/lib/status';
import type { OrderSummary } from '@/lib/types';

function OrderRow({ o }: { o: OrderSummary }) {
  const { c, radius } = useTheme();
  const t = useT();
  const color = statusColor(o.status, c);
  return (
    <Card onPress={() => router.push({ pathname: '/orders/[id]', params: { id: String(o.id), key: o.key || '' } })} style={{ marginHorizontal: 16 }}>
      <Row gap={12}>
        <View style={{ width: 60, height: 60, borderRadius: Math.min(radius, 12), overflow: 'hidden', backgroundColor: c.primarySoft }}>
          {o.thumb ? <Image source={{ uri: o.thumb }} style={{ flex: 1 }} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt weight="bold">
              {t('order')} #{o.number}
            </Txt>
            <Txt weight="bold" color={c.primaryText}>
              {money(o.total)}
            </Txt>
          </Row>
          <Txt size={13} muted>
            {dateShort(o.date)} · {o.items_count === 1 ? t('item') : t('items', { n: o.items_count })}
          </Txt>
          <View style={{ alignSelf: 'flex-start', backgroundColor: alpha(color, 0.12), paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, marginTop: 2 }}>
            <Txt size={12} weight="bold" color={color}>
              {o.status_label}
            </Txt>
          </View>
        </View>
      </Row>
    </Card>
  );
}

export default function Orders() {
  const { c } = useTheme();
  const t = useT();
  const loggedIn = useAuth((s) => !!s.token);
  const guest = useLocal((s) => s.orders);
  const q = useOrders(loggedIn);

  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Header title={t('recentOrders')} />
        {guest.length ? (
          <FlatList data={guest} keyExtractor={(o) => String(o.id)} contentContainerStyle={{ gap: 12, paddingVertical: 12 }} renderItem={({ item }) => <OrderRow o={{ ...item, status_label: item.status_label || item.status }} />} />
        ) : (
          <Empty icon="receipt-outline" title={t('noOrders')} action={t('startShopping')} onAction={() => router.replace('/')} />
        )}
      </View>
    );
  }

  const orders = q.data?.pages.flatMap((p) => p.orders) || [];
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('myOrders')} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ gap: 12, paddingVertical: 12, flexGrow: 1 }}
          renderItem={({ item }) => <OrderRow o={item} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={c.primaryText} />}
          ListEmptyComponent={<Empty icon="receipt-outline" title={t('noOrders')} action={t('startShopping')} onAction={() => router.replace('/')} />}
          ListFooterComponent={q.isFetchingNextPage ? <Loading style={{ padding: 16 }} /> : undefined}
        />
      )}
    </View>
  );
}
