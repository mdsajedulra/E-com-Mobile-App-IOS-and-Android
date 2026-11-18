import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductGrid } from '@/components/grid';
import { IconButton, Row, Txt } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { kv } from '@/lib/storage';
import { useTheme } from '@/lib/theme';

export default function Search() {
  const { c, radius, font } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    kv.getJSON<string[]>('recent_searches', []).then(setRecent);
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 400);
    return () => clearTimeout(id);
  }, [text]);

  const remember = (s: string) => {
    if (!s) return;
    const next = [s, ...recent.filter((r) => r.toLowerCase() !== s.toLowerCase())].slice(0, 8);
    setRecent(next);
    kv.setJSON('recent_searches', next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Row gap={4} style={{ paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 10 }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Row
          gap={8}
          style={{
            flex: 1,
            height: 46,
            borderRadius: Math.min(radius, 23),
            backgroundColor: c.surface,
            borderWidth: 1.5,
            borderColor: c.primaryText,
            paddingHorizontal: 14,
            marginRight: 8,
          }}
        >
          <Ionicons name="search" size={19} color={c.muted} />
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={c.muted}
            returnKeyType="search"
            onSubmitEditing={() => remember(text.trim())}
            autoCorrect={false}
            style={{ flex: 1, color: c.text, fontSize: 16, fontFamily: font.regular }}
          />
          {text ? (
            <Pressable onPress={() => setText('')} hitSlop={10}>
              <Ionicons name="close-circle" size={19} color={c.muted} />
            </Pressable>
          ) : null}
        </Row>
      </Row>
      {q.length >= 2 ? (
        <ProductGrid query={{ search: q }} />
      ) : recent.length ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Row style={{ flexWrap: 'wrap' }} gap={8}>
            {recent.map((r) => (
              <Pressable
                key={r}
                onPress={() => setText(r)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
              >
                <Ionicons name="time-outline" size={14} color={c.muted} />
                <Txt size={13.5}>{r}</Txt>
              </Pressable>
            ))}
          </Row>
        </View>
      ) : null}
    </View>
  );
}
