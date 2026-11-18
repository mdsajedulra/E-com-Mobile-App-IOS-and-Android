import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandHero, HomeSections } from '@/components/home';
import { ErrorState, IconButton, Row, Txt } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { decode } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCart } from '@/lib/stores';
import { useTheme } from '@/lib/theme';

export default function Home() {
  const { c, radius } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { config, live, error, refresh } = useConfig();
  const count = useCart((s) => s.cart?.items_count || 0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh().catch(() => {}), qc.invalidateQueries(), useCart.getState().load()]);
    setRefreshing(false);
  };

  const sections = config.home?.sections || [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: c.background }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={10} style={{ flex: 1 }}>
            {config.site.logo ? (
              <Image source={{ uri: config.site.logo }} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="contain" />
            ) : null}
            <View style={{ flex: 1 }}>
              <Txt size={17} weight="heading" numberOfLines={1}>
                {decode(config.site.name)}
              </Txt>
              {config.site.tagline ? (
                <Txt size={12} muted numberOfLines={1}>
                  {decode(config.site.tagline)}
                </Txt>
              ) : null}
            </View>
          </Row>
          <IconButton name="bag-handle-outline" badge={count} onPress={() => router.push('/cart')} />
        </Row>
        <Pressable
          onPress={() => router.push('/search')}
          style={{
            marginTop: 12,
            height: 46,
            borderRadius: Math.min(radius, 23),
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Ionicons name="search" size={19} color={c.muted} />
          <Txt muted style={{ flex: 1 }}>
            {t('searchPlaceholder')}
          </Txt>
        </Pressable>
      </View>

      {!live && error ? (
        <ErrorState error={{ status: 0 }} onRetry={() => refresh().catch(() => {})} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primaryText} colors={[c.primary]} />}
        >
          {sections.length ? <HomeSections sections={sections} /> : <BrandHero />}
        </ScrollView>
      )}
    </View>
  );
}
