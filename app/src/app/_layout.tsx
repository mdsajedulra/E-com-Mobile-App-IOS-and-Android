import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/ui';
import { restoreCartToken } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { listenToNotificationTaps, registerPush, restorePushToken } from '@/lib/push';
import { useAuth, useCart, useLocal, useWishlist } from '@/lib/stores';
import { ThemeProvider, useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function Shell() {
  const { c, dark } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.background).catch(() => {});
  }, [c.background]);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="order-success" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = useConfig.getState();
      await Promise.all([
        cfg.hydrate(),
        restoreCartToken(),
        useAuth.getState().restore(),
        useWishlist.getState().restore(),
        useLocal.getState().restore(),
        restorePushToken(),
      ]);
      // First launch waits for the live config (max ~4s); later launches use the cache instantly.
      const live = useConfig.getState().live;
      const refresh = cfg.refresh().catch(() => {});
      if (!live) await Promise.race([refresh, new Promise((r) => setTimeout(r, 4000))]);
      setReady(true);
      useCart.getState().load();
      // Re-register silently if permission was already granted.
      registerPush(false);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    return listenToNotificationTaps();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
