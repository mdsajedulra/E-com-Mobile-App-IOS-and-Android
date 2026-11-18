import * as Device from 'expo-device';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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

export default function Register() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { c } = useTheme();
  const t = useT();
  const config = useConfig((s) => s.config);
  const setSession = useAuth((s) => s.setSession);
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };
  const privacy = config.pages?.find((p) => p.key === 'privacy' || p.key === 'terms');

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = t('required', { field: t('name') });
    if (!f.phone.trim()) e.phone = t('required', { field: t('phone') });
    else if (config.site.currency.code === 'BDT' && !/^(\+?880|0)?1[3-9]\d{8}$/.test(f.phone.replace(/[^0-9+]/g, ''))) e.phone = t('invalidPhone');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = t('invalidEmail');
    if (f.password.length < 6) e.password = t('required', { field: `${t('password')} (6+)` });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = (await app('auth/register', { body: { ...f, device: Device.modelName || '' } })) as { token: string; user: User };
      await setSession(res.token, res.user);
      toast(`${t('welcome')}, ${res.user.first_name || res.user.name}`);
      if (next) router.replace(next as any);
      else router.back();
    } catch (err: any) {
      setErrors({ form: err?.message || t('somethingWrong') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="" keyboard>
      <Txt size={26} weight="heading">
        {t('register')}
      </Txt>
      <Txt muted style={{ marginTop: 6, marginBottom: 24 }}>
        {t('createHint')}
      </Txt>
      <Input label={t('name')} icon="person-outline" value={f.name} onChangeText={set('name')} autoCapitalize="words" autoComplete="name" error={errors.name} />
      <Input label={t('phone')} icon="call-outline" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="01XXXXXXXXX" error={errors.phone} />
      <Input label={t('emailOptional')} icon="mail-outline" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
      <Input label={t('password')} icon="lock-closed-outline" value={f.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={errors.password || errors.form} />
      <Button title={t('register')} size="lg" loading={busy} onPress={submit} style={{ marginTop: 6 }} />
      {privacy ? (
        <Pressable onPress={() => WebBrowser.openBrowserAsync(privacy.url)} style={{ marginTop: 14 }}>
          <Txt size={12.5} muted center>
            {privacy.title}
          </Txt>
        </Pressable>
      ) : null}
      <Row gap={6} style={{ justifyContent: 'center', marginTop: 20 }}>
        <Txt muted>{t('haveAccount')}</Txt>
        <Pressable onPress={() => router.replace({ pathname: '/login', params: { next: next || '' } })}>
          <Txt weight="bold" color={c.primaryText}>
            {t('login')}
          </Txt>
        </Pressable>
      </Row>
      <View style={{ height: 20 }} />
    </Screen>
  );
}
