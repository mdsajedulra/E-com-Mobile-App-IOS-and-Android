import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/layout';
import { Button, Card, Input, ListItem, Sheet, Txt, toast } from '@/components/ui';
import { app, setAuthToken } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { pushToken } from '@/lib/push';
import { secure } from '@/lib/storage';
import { useAuth } from '@/lib/stores';
import type { User } from '@/lib/types';

export default function Profile() {
  const t = useT();
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(user?.billing?.address_1 || '');
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');

  if (!user) {
    return <Redirect href="/login" />;
  }

  const save = async () => {
    setBusy(true);
    try {
      const u = (await app('me', { body: { name, phone, email, billing: { address_1: address, phone } } })) as User;
      setUser(u);
      toast(t('saved'));
    } catch (e: any) {
      toast(e?.message || t('somethingWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('editProfile')} keyboard>
      <Input label={t('name')} icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" />
      <Input label={t('phone')} icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Input label={t('emailOptional')} icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label={t('billingAddress')} icon="location-outline" value={address} onChangeText={setAddress} multiline />
      <Button title={t('save')} size="lg" loading={busy} onPress={save} />

      <Card style={{ marginTop: 22, paddingVertical: 4 }}>
        <ListItem icon="key-outline" title={t('changePassword')} onPress={() => setPwOpen(true)} />
        <ListItem icon="trash-outline" title={t('deleteAccount')} danger onPress={() => setDelOpen(true)} />
      </Card>

      <Sheet visible={pwOpen} onClose={() => setPwOpen(false)} title={t('changePassword')}>
        <Input label={t('currentPassword')} value={cur} onChangeText={setCur} secureTextEntry />
        <Input label={t('newPassword')} value={next} onChangeText={setNext} secureTextEntry error={err} />
        <Button
          title={t('save')}
          onPress={async () => {
            setErr('');
            try {
              const r = (await app('me/password', { body: { current: cur, password: next } })) as { token: string };
              setAuthToken(r.token);
              await secure.set('auth_token', r.token);
              useAuth.setState({ token: r.token });
              setPwOpen(false);
              setCur('');
              setNext('');
              toast(t('saved'));
            } catch (e: any) {
              setErr(e?.message || t('somethingWrong'));
            }
          }}
        />
      </Sheet>

      <Sheet visible={delOpen} onClose={() => setDelOpen(false)} title={t('deleteAccount')}>
        <Txt muted style={{ marginBottom: 14 }}>
          {t('deleteWarning')}
        </Txt>
        <Input label={t('password')} value={cur} onChangeText={setCur} secureTextEntry error={err} />
        <View style={{ gap: 10 }}>
          <Button
            title={t('deleteAccount')}
            variant="danger"
            onPress={async () => {
              setErr('');
              try {
                await app('me', { method: 'DELETE', body: { password: cur } });
                setDelOpen(false);
                await logout(pushToken());
                router.replace('/');
              } catch (e: any) {
                setErr(e?.message || t('somethingWrong'));
              }
            }}
          />
          <Button title={t('cancel')} variant="ghost" onPress={() => setDelOpen(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}
