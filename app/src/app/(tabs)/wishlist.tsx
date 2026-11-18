import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard, useGridWidth } from '@/components/product';
import { Empty, Txt } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useWishlist } from '@/lib/stores';
import { useTheme } from '@/lib/theme';

export default function Wishlist() {
  const { c } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const items = useWishlist((s) => s.items);
  const { cols, w } = useGridWidth();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Txt size={26} weight="heading" style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8 }}>
        {t('wishlist')}
      </Txt>
      {!items.length ? (
        <Empty icon="heart-outline" title={t('emptyWishlist')} hint={t('emptyWishlistHint')} action={t('startShopping')} onAction={() => router.push('/products')} />
      ) : (
        <FlatList
          key={cols}
          data={items}
          numColumns={cols}
          keyExtractor={(p) => String(p.id)}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 20, paddingVertical: 12, paddingBottom: 40 }}
          renderItem={({ item }) => <ProductCard p={item} width={w} />}
        />
      )}
    </View>
  );
}
