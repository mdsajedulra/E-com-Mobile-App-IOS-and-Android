import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useT } from '@/lib/i18n';
import { alpha, useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ---------------- Text ---------------- */

type TxtProps = TextProps & {
  size?: number;
  weight?: 'regular' | 'semibold' | 'bold' | 'heading';
  color?: string;
  muted?: boolean;
  center?: boolean;
};

export function Txt({ size = 15, weight = 'regular', color, muted, center, style, ...rest }: TxtProps) {
  const { c, font } = useTheme();
  const family = weight === 'heading' ? font.heading : weight === 'bold' ? font.bold : weight === 'semibold' ? font.semibold : font.regular;
  const fw: TextStyle['fontWeight'] = weight === 'regular' ? '400' : weight === 'semibold' ? '600' : '700';
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.38),
          color: color || (muted ? c.muted : c.text),
          textAlign: center ? 'center' : undefined,
        },
        family ? { fontFamily: family } : { fontWeight: fw },
        style,
      ]}
    />
  );
}

export const Title = (p: TxtProps) => <Txt size={22} weight="heading" {...p} />;

/* ---------------- Buttons ---------------- */

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, size = 'md', style, flex }: BtnProps) {
  const { c, radius } = useTheme();
  const bg =
    variant === 'primary' ? c.primary : variant === 'secondary' ? c.secondary : variant === 'danger' ? c.danger : 'transparent';
  const fg =
    variant === 'primary' ? c.onPrimary : variant === 'secondary' ? c.onSecondary : variant === 'danger' ? '#FFFFFF' : c.primaryText;
  const h = size === 'lg' ? 54 : size === 'sm' ? 38 : 48;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: Math.min(radius, h / 2),
          backgroundColor: bg,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: c.primaryText,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        flex && { flex: 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={fg} /> : null}
          <Txt weight="bold" size={size === 'sm' ? 13.5 : 15.5} color={fg} numberOfLines={1}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  size = 22,
  color,
  badge,
  filled,
  style,
}: {
  name: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  badge?: number;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? c.surface : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
        filled && shadow(c.text, 0.08),
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color || c.text} />
      {badge ? <Badge count={badge} style={{ position: 'absolute', top: 3, right: 1 }} /> : null}
    </Pressable>
  );
}

export function Badge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 5,
          backgroundColor: c.sale,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: c.background,
        },
        style,
      ]}
    >
      <Txt size={10.5} weight="bold" color="#FFFFFF" style={{ lineHeight: 13 }}>
        {count > 99 ? '99+' : count}
      </Txt>
    </View>
  );
}

/* ---------------- Layout ---------------- */

export function shadow(color: string, opacity = 0.08): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: Math.round(opacity * 40) },
    default: {},
  }) as ViewStyle;
}

export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const { c, radius } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: padded ? 16 : 0,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 12 }, style]} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 }}>
      <Txt size={19} weight="heading" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Row gap={2}>
            <Txt size={13.5} weight="semibold" color={c.primaryText}>
              {action}
            </Txt>
            <Ionicons name="chevron-forward" size={15} color={c.primaryText} />
          </Row>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function ListItem({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  const { c, radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row gap={14} style={{ paddingVertical: 13 }}>
        {icon ? (
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: Math.min(radius, 12),
              backgroundColor: danger ? alpha(c.danger, 0.12) : c.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={19} color={danger ? c.danger : c.primaryText} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" color={danger ? c.danger : undefined}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt size={13} muted numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null)}
      </Row>
    </Pressable>
  );
}

/* ---------------- Inputs ---------------- */

type InputProps = TextInputProps & { label?: string; error?: string; icon?: IconName; right?: ReactNode };

export const Input = forwardRef<TextInputInstance, InputProps>(function Input({ label, error, icon, right, style, multiline, ...rest }, ref) {
  const { c, radius, font } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Txt size={13.5} weight="semibold" style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <Row
        gap={10}
        style={{
          minHeight: multiline ? 92 : 50,
          borderRadius: Math.min(radius, 14),
          borderWidth: 1.5,
          borderColor: error ? c.danger : focus ? c.primaryText : c.border,
          backgroundColor: c.surface,
          paddingHorizontal: 14,
          alignItems: multiline ? 'flex-start' : 'center',
        }}
      >
        {icon ? <Ionicons name={icon} size={19} color={c.muted} style={multiline ? { marginTop: 14 } : undefined} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.muted}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          multiline={multiline}
          style={[
            {
              flex: 1,
              color: c.text,
              fontSize: 15.5,
              paddingVertical: multiline ? 12 : 0,
              minHeight: multiline ? 88 : 48,
              textAlignVertical: multiline ? 'top' : 'center',
              fontFamily: font.regular,
            },
            style,
          ]}
          {...rest}
        />
        {right}
      </Row>
      {error ? (
        <Txt size={12.5} color={c.danger} style={{ marginTop: 5 }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
});

/** Tap-to-open picker field (district, thana...). */
export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  error,
  disabled,
}: {
  label?: string;
  value: string;
  placeholder?: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { c, radius } = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Txt size={13.5} weight="semibold" style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          height: 50,
          borderRadius: Math.min(radius, 14),
          borderWidth: 1.5,
          borderColor: error ? c.danger : c.border,
          backgroundColor: c.surface,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Txt style={{ flex: 1 }} muted={!selected} numberOfLines={1}>
          {selected ? selected.label : placeholder || label}
        </Txt>
        <Ionicons name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      {error ? (
        <Txt size={12.5} color={c.danger} style={{ marginTop: 5 }}>
          {error}
        </Txt>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} tall>
        {options.length > 8 ? (
          <Input icon="search" placeholder={t('search')} value={q} onChangeText={setQ} autoCorrect={false} />
        ) : null}
        <Animated.FlatList
          data={filtered}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onChange(item.value);
                setOpen(false);
                setQ('');
              }}
              style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center' })}
            >
              <Txt style={{ flex: 1 }} weight={item.value === value ? 'bold' : 'regular'} color={item.value === value ? c.primaryText : undefined}>
                {item.label}
              </Txt>
              {item.value === value ? <Ionicons name="checkmark" size={20} color={c.primaryText} /> : null}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />}
        />
      </Sheet>
    </View>
  );
}

/* ---------------- Sheet ---------------- */

export function Sheet({
  visible,
  onClose,
  title,
  children,
  tall,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  tall?: boolean;
}) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: c.background,
          borderTopLeftRadius: Math.max(radius, 18),
          borderTopRightRadius: Math.max(radius, 18),
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: insets.bottom + 16,
          maxHeight: tall ? '80%' : '70%',
          minHeight: tall ? '60%' : undefined,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 12 }} />
        {title ? (
          <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Txt size={18} weight="heading">
              {title}
            </Txt>
            <IconButton name="close" onPress={onClose} />
          </Row>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

/* ---------------- States ---------------- */

export function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }, style]}>
      <ActivityIndicator color={c.primaryText} size="large" />
    </View>
  );
}

export function Empty({ icon, title, hint, action, onAction }: { icon: IconName; title: string; hint?: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 10 }}>
      <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Ionicons name={icon} size={40} color={c.primaryText} />
      </View>
      <Txt size={18} weight="heading" center>
        {title}
      </Txt>
      {hint ? (
        <Txt muted center>
          {hint}
        </Txt>
      ) : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: 12, minWidth: 200 }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  const offline = (error as any)?.status === 0;
  return (
    <Empty
      icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
      title={offline ? t('offline') : t('somethingWrong')}
      hint={offline ? t('offlineHint') : (error as any)?.message}
      action={onRetry ? t('retry') : undefined}
      onAction={onRetry}
    />
  );
}

export function Skeleton({ w, h, r, style }: { w?: number | `${number}%`; h: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const { c, radius } = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ width: w ?? '100%', height: h, borderRadius: r ?? radius, backgroundColor: c.border, opacity: v }, style]} />;
}

/* ---------------- Toast ---------------- */

type ToastState = { msg: string; kind: 'ok' | 'error'; show: (msg: string, kind?: 'ok' | 'error') => void };

export const useToast = create<ToastState>((set) => ({
  msg: '',
  kind: 'ok',
  show(msg, kind = 'ok') {
    set({ msg, kind });
    setTimeout(() => set((s) => (s.msg === msg ? { msg: '' } : s)), 2600);
  },
}));

export const toast = (msg: string, kind: 'ok' | 'error' = 'ok') => useToast.getState().show(msg, kind);

export function ToastHost() {
  const { msg, kind } = useToast();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 90, alignItems: 'center' }}>
      <Row
        gap={10}
        style={[
          {
            backgroundColor: kind === 'error' ? c.danger : c.text,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: Math.min(radius, 16),
            maxWidth: 480,
          },
          shadow('#000', 0.2),
        ]}
      >
        <Ionicons name={kind === 'error' ? 'alert-circle' : 'checkmark-circle'} size={20} color={kind === 'error' ? '#fff' : c.background} />
        <Txt color={kind === 'error' ? '#fff' : c.background} weight="semibold" style={{ flexShrink: 1 }}>
          {msg}
        </Txt>
      </Row>
    </View>
  );
}
