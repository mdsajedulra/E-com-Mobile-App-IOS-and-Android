import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { IconButton, Row, Txt } from './ui';

/** Top bar used on every pushed screen. */
export function Header({
  title,
  back = true,
  right,
  transparent,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  transparent?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 4,
        paddingBottom: 6,
        paddingHorizontal: 8,
        backgroundColor: transparent ? 'transparent' : c.background,
        position: transparent ? 'absolute' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
      }}
    >
      <Row style={{ minHeight: 44 }}>
        {back ? (
          <IconButton
            name="chevron-back"
            filled={transparent}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ) : (
          <View style={{ width: 8 }} />
        )}
        <Txt size={17.5} weight="heading" numberOfLines={1} style={{ flex: 1, textAlign: back ? 'center' : 'left', marginRight: back && !right ? 42 : 0 }}>
          {transparent ? '' : title || ''}
        </Txt>
        {right ?? null}
      </Row>
    </View>
  );
}

/** Basic screen: background color + optional header + scroll. */
export function Screen({
  title,
  back = true,
  right,
  children,
  scroll = true,
  footer,
  contentStyle,
  scrollProps,
  keyboard,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
  keyboard?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ padding: 16, paddingBottom: footer ? 24 : insets.bottom + 24 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  const inner = (
    <>
      {title !== undefined || back ? <Header title={title} back={back} right={right} /> : null}
      {body}
      {footer ? <Footer>{footer}</Footer> : null}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

/** Sticky bottom bar (checkout, add to cart...). */
export function Footer({ children, tight }: { children: ReactNode; tight?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: tight ? 12 : Math.max(insets.bottom, 12),
        backgroundColor: c.background,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      {children}
    </View>
  );
}
