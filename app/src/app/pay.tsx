import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { Header } from '@/components/layout';
import { Txt } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/**
 * Online payment (bKash, SSLCommerz, Stripe checkout page...) in a secure in-app web view.
 * When the gateway sends the customer back to the store's "order received" page, we close it.
 */
export default function Pay() {
  const { url, id, key, total } = useLocalSearchParams<{ url: string; id: string; key: string; total?: string }>();
  const { c } = useTheme();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const done = useRef(false);

  const finish = (ok: boolean) => {
    if (done.current) return;
    done.current = true;
    if (ok) router.replace({ pathname: '/order-success', params: { id, key, total: total || '' } });
    else router.replace({ pathname: '/orders/[id]', params: { id, key } });
  };

  const onNav = (nav: WebViewNavigation) => {
    const u = nav.url || '';
    if (/order-received|thank-you|checkout\/order-received/.test(u)) finish(true);
    else if (/cancel_order=true|payment-failed|\/cart\/?(\?|$)/.test(u)) finish(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('payNow')} right={null} />
      <WebView
        source={{ uri: url }}
        onNavigationStateChange={onNav}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        sharedCookiesEnabled
        style={{ flex: 1 }}
      />
      {loading ? (
        <View style={{ position: 'absolute', top: 120, left: 0, right: 0, alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={c.primaryText} size="large" />
          <Txt muted>{t('processingPayment')}</Txt>
        </View>
      ) : null}
    </View>
  );
}
