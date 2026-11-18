import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Divider, ListItem, Row, Txt } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { decode } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { permissionStatus, pushToken, registerPush } from '@/lib/push';
import { useAuth, useLocal } from '@/lib/stores';
import { useTheme } from '@/lib/theme';
import type { IconName } from '@/components/ui';

const pageIcons: Record<string, IconName> = {
  privacy: 'shield-checkmark-outline',
  terms: 'document-text-outline',
  about: 'information-circle-outline',
  refund: 'refresh-circle-outline',
  contact: 'chatbubbles-outline',
  faq: 'help-circle-outline',
};

export default function Account() {
  const { c } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();
  const config = useConfig((s) => s.config);
  const guestOrders = useLocal((s) => s.orders);
  const [push, setPush] = useState('granted');

  useFocusEffect(
    useCallback(() => {
      permissionStatus().then(setPush);
    }, [])
  );

  const contact = config.contact;
  const wa = contact?.whatsapp?.replace(/[^0-9]/g, '');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 40 }}>
      <Txt size={26} weight="heading" style={{ marginBottom: 14 }}>
        {t('account')}
      </Txt>

      {token && user ? (
        <Card onPress={() => router.push('/profile')}>
          <Row gap={14}>
            <Image source={{ uri: user.avatar }} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: c.primarySoft }} />
            <View style={{ flex: 1 }}>
              <Txt size={18} weight="heading" numberOfLines={1}>
                {user.name || user.phone}
              </Txt>
              <Txt muted numberOfLines={1}>
                {user.phone || user.email}
              </Txt>
            </View>
            <Ionicons name="create-outline" size={20} color={c.muted} />
          </Row>
        </Card>
      ) : (
        <Card style={{ backgroundColor: c.primary, borderColor: c.primary }}>
          <Txt size={19} weight="heading" color={c.onPrimary}>
            {t('welcome')}
          </Txt>
          <Txt color={c.onPrimary} style={{ opacity: 0.85, marginTop: 4 }}>
            {t('welcomeHint')}
          </Txt>
          <Row gap={10} style={{ marginTop: 16 }}>
            <Button title={t('login')} variant="secondary" flex onPress={() => router.push('/login')} />
            {config.features.registration ? (
              <Button title={t('register')} variant="ghost" flex style={{ borderWidth: 1.5, borderColor: c.onPrimary }} onPress={() => router.push('/register')} />
            ) : null}
          </Row>
        </Card>
      )}

      <Card style={{ marginTop: 16, paddingVertical: 4 }}>
        {token ? <ListItem icon="receipt-outline" title={t('myOrders')} subtitle={user?.orders_count ? String(user.orders_count) : undefined} onPress={() => router.push('/orders')} /> : null}
        {!token && guestOrders.length ? <ListItem icon="receipt-outline" title={t('recentOrders')} subtitle={`${guestOrders.length}`} onPress={() => router.push('/orders')} /> : null}
        <ListItem icon="locate-outline" title={t('trackOrder')} onPress={() => router.push('/track')} />
        {config.features.wishlist ? <ListItem icon="heart-outline" title={t('wishlist')} onPress={() => router.push('/wishlist')} /> : null}
        {push !== 'granted' ? (
          <ListItem
            icon="notifications-outline"
            title={t('pushTitle')}
            subtitle={t('pushHint')}
            onPress={async () => {
              const tok = await registerPush(true);
              setPush(tok ? 'granted' : await permissionStatus());
              if (!tok && (await permissionStatus()) === 'denied') Linking.openSettings();
            }}
          />
        ) : null}
      </Card>

      {contact && (contact.phone || wa || contact.email || contact.facebook) ? (
        <>
          <Txt weight="bold" muted size={13} style={{ marginTop: 22, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {t('help')}
          </Txt>
          <Card style={{ paddingVertical: 4 }}>
            {contact.phone ? <ListItem icon="call-outline" title={t('callUs')} subtitle={contact.phone} onPress={() => Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`)} /> : null}
            {wa ? <ListItem icon="logo-whatsapp" title={t('whatsapp')} subtitle={contact.whatsapp} onPress={() => Linking.openURL(`https://wa.me/${wa.startsWith('0') ? '88' + wa : wa}`)} /> : null}
            {contact.email ? <ListItem icon="mail-outline" title={t('emailUs')} subtitle={contact.email} onPress={() => Linking.openURL(`mailto:${contact.email}`)} /> : null}
            {contact.facebook ? <ListItem icon="logo-facebook" title={t('facebook')} onPress={() => Linking.openURL(contact.facebook)} /> : null}
          </Card>
        </>
      ) : null}

      {config.pages?.length ? (
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          {config.pages.map((p) => (
            <ListItem key={p.key} icon={pageIcons[p.key] || 'document-outline'} title={decode(p.title)} onPress={() => WebBrowser.openBrowserAsync(p.url, { toolbarColor: c.background, controlsColor: c.primaryText })} />
          ))}
        </Card>
      ) : null}

      {token ? (
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          <ListItem
            icon="log-out-outline"
            title={t('logout')}
            danger
            onPress={() =>
              Alert.alert(t('logout'), '', [
                { text: t('cancel'), style: 'cancel' },
                { text: t('logout'), style: 'destructive', onPress: () => logout(pushToken()) },
              ])
            }
          />
        </Card>
      ) : null}

      <Divider style={{ marginTop: 24, opacity: 0 }} />
      <Txt size={12} muted center>
        {decode(config.site.name)} · {t('version')} {Application.nativeApplicationVersion || '1.0.0'}
      </Txt>
    </ScrollView>
  );
}
