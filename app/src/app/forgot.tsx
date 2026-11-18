import { useState } from 'react';
import { Screen } from '@/components/layout';
import { Button, Card, Input, Txt } from '@/components/ui';
import { app } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function Forgot() {
  const t = useT();
  const [login, setLogin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  return (
    <Screen title={t('forgot')} keyboard>
      <Input label={t('phoneOrEmail')} icon="person-outline" value={login} onChangeText={setLogin} autoCapitalize="none" error={error} />
      <Button
        title={t('sendReset')}
        size="lg"
        loading={busy}
        disabled={!login.trim()}
        onPress={async () => {
          setBusy(true);
          setError('');
          try {
            const r = (await app('auth/forgot', { body: { login: login.trim() } })) as { message: string };
            setMsg(r.message);
          } catch (e: any) {
            setError(e?.message || t('somethingWrong'));
          } finally {
            setBusy(false);
          }
        }}
      />
      {msg ? (
        <Card style={{ marginTop: 18 }}>
          <Txt>{msg}</Txt>
        </Card>
      ) : null}
    </Screen>
  );
}
