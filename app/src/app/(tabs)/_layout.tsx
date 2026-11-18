import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';
import { useConfig } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { useCart, useWishlist } from '@/lib/stores';
import { useTheme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { c, font } = useTheme();
  const t = useT();
  const count = useCart((s) => s.cart?.items_count || 0);
  const wishCount = useWishlist((s) => s.items.length);
  const wishlistOn = useConfig((s) => s.config.features.wishlist);

  const icon =
    (on: IconName, off: IconName) =>
    ({ focused, color, size }: { focused: boolean; color: unknown; size: number }) => <Ionicons name={focused ? on : off} size={size - 1} color={color as string} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11.5, fontFamily: font.semibold, fontWeight: font.semibold ? undefined : '600', marginBottom: Platform.OS === 'android' ? 8 : 0 },
        tabBarBadgeStyle: { backgroundColor: c.sale, fontSize: 10.5 },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="categories" options={{ title: t('categories'), tabBarIcon: icon('grid', 'grid-outline') }} />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: t('wishlist'),
          tabBarIcon: icon('heart', 'heart-outline'),
          href: wishlistOn ? undefined : null,
          tabBarBadge: wishCount ? wishCount : undefined,
          tabBarBadgeStyle: { backgroundColor: c.primary, color: c.onPrimary, fontSize: 10.5 },
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{ title: t('cart'), tabBarIcon: icon('bag-handle', 'bag-handle-outline'), tabBarBadge: count ? count : undefined }}
      />
      <Tabs.Screen name="account" options={{ title: t('account'), tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
