import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/layout';
import { Button, Input, Row, Txt, toast } from '@/components/ui';
import { app } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/stores';
import { useTheme } from '@/lib/theme';
import type { User } from '@/lib/types';
import * as Device from 'expo-device';
import { Image } from 'expo-image';

export default function Login() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { c } = useTheme();
  const t = useT();
  const config = useConfig((s) => s.config);
  const setSession = useAuth((s) => s.setSession);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!login.trim() || !password) {
      setError(t('required', { field: !login.trim() ? t('phoneOrEmail') : t('password') }));
      return;
    }
    setBusy(true);
    try {
      const res = (await app('auth/login', { body: { login: login.trim(), password, device: Device.modelName || '' } })) as { token: string; user: User };
      await setSession(res.token, res.user);
      toast(`${t('welcome')}, ${res.user.first_name || res.user.name}`);
      if (next) router.replace(next as any);
      else router.back();
    } catch (e: any) {
      setError(e?.message || t('somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="" keyboard>
      <View style={{ alignItems: 'center', marginBottom: 26 }}>
        {config.site.logo ? <Image source={{ uri: config.site.logo }} style={{ width: 76, height: 76, borderRadius: 18, marginBottom: 14 }} contentFit="contain" /> : null}
        <Txt size={26} weight="heading" center>
          {t('welcome')}
        </Txt>
        <Txt muted center style={{ marginTop: 6 }}>
          {t('welcomeHint')}
        </Txt>
      </View>
      <Input label={t('phoneOrEmail')} icon="person-outline" value={login} onChangeText={setLogin} autoCapitalize="none" autoComplete="username" keyboardType="email-address" textContentType="username" />
      <Input
        label={t('password')}
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        right={
          <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        }
        error={error}
      />
      <Pressable onPress={() => router.push('/forgot')} style={{ alignSelf: 'flex-end', marginBottom: 20 }}>
        <Txt weight="semibold" color={c.primaryText}>
          {t('forgot')}
        </Txt>
      </Pressable>
      <Button title={t('login')} size="lg" loading={busy} onPress={submit} />
      {config.features.registration ? (
        <Row gap={6} style={{ justifyContent: 'center', marginTop: 22 }}>
          <Txt muted>{t('noAccount')}</Txt>
          <Pressable onPress={() => router.replace({ pathname: '/register', params: { next: next || '' } })}>
            <Txt weight="bold" color={c.primaryText}>
              {t('register')}
            </Txt>
          </Pressable>
        </Row>
      ) : null}
      {next === '/checkout' && config.features.guest_checkout ? (
        <Button title={t('checkoutAsGuest')} variant="ghost" style={{ marginTop: 12 }} onPress={() => router.replace('/checkout')} />
      ) : null}
    </Screen>
  );
}
