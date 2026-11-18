import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Row, Sheet, Txt } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { permissionStatus, registerPush } from '@/lib/push';
import { useTheme } from '@/lib/theme';

export default function OrderSuccess() {
  const { id, key, total } = useLocalSearchParams<{ id: string; key: string; total?: string }>();
  const { c } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.4)).current;
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    // Best moment to ask for notifications: right after the first order.
    permissionStatus().then((s) => s === 'undetermined' && setTimeout(() => setAsk(true), 900));
  }, [scale]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 24, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }}>
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Animated.View
          style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}
        >
          <Ionicons name="checkmark" size={62} color={c.onPrimary} />
        </Animated.View>
        <Txt size={26} weight="heading" center style={{ marginTop: 26 }}>
          {t('orderPlaced')}
        </Txt>
        <Txt muted center style={{ marginTop: 8, maxWidth: 320 }}>
          {t('orderPlacedHint')}
        </Txt>
        <Card style={{ marginTop: 28, alignSelf: 'stretch' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt muted>{t('orderNumber')}</Txt>
            <Txt weight="bold">#{id}</Txt>
          </Row>
          {total ? (
            <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <Txt muted>{t('total')}</Txt>
              <Txt weight="bold" color={c.primaryText}>
                {total}
              </Txt>
            </Row>
          ) : null}
        </Card>
      </View>
      <View style={{ gap: 10 }}>
        <Button title={t('viewOrder')} variant="outline" onPress={() => router.replace({ pathname: '/orders/[id]', params: { id, key } })} />
        <Button title={t('continueShopping')} onPress={() => router.replace('/')} />
      </View>

      <Sheet visible={ask} onClose={() => setAsk(false)}>
        <View style={{ alignItems: 'center', paddingVertical: 10, gap: 8 }}>
          <Ionicons name="notifications" size={40} color={c.primaryText} />
          <Txt size={19} weight="heading" center>
            {t('pushTitle')}
          </Txt>
          <Txt muted center>
            {t('pushHint')}
          </Txt>
          <Row gap={10} style={{ marginTop: 14, alignSelf: 'stretch' }}>
            <Button title={t('notNow')} variant="ghost" flex onPress={() => setAsk(false)} />
            <Button
              title={t('allow')}
              flex
              onPress={async () => {
                setAsk(false);
                await registerPush(true);
              }}
            />
          </Row>
        </View>
      </Sheet>
    </View>
  );
}
