import * as Font from 'expo-font';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useConfig } from './config';
import type { Palette } from './types';

export type Theme = {
  c: Palette;
  dark: boolean;
  radius: number;
  font: { regular?: string; semibold?: string; bold?: string; heading?: string };
  space: (n: number) => number;
};

const Ctx = createContext<Theme | null>(null);

/** Loads the store's Google Fonts at runtime. Never blocks the app longer than 2.5s. */
function useBrandFonts() {
  const fonts = useConfig((s) => s.config.theme.fonts);
  const [loaded, setLoaded] = useState<Theme['font']>({});
  const key = JSON.stringify(fonts);

  useEffect(() => {
    let alive = true;
    const map: Record<string, string> = {};
    if (fonts.body) {
      map['Brand-Regular'] = fonts.body.regular;
      map['Brand-SemiBold'] = fonts.body.semibold;
      map['Brand-Bold'] = fonts.body.bold;
    }
    if (fonts.heading) map['Brand-Heading'] = fonts.heading.bold;
    if (!Object.keys(map).length) {
      setLoaded({});
      return;
    }
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([Font.loadAsync(map), timeout])
      .then(() => {
        if (!alive) return;
        const ok = (f: string) => (Font.isLoaded(f) ? f : undefined);
        setLoaded({
          regular: ok('Brand-Regular'),
          semibold: ok('Brand-SemiBold'),
          bold: ok('Brand-Bold'),
          heading: ok('Brand-Heading') || ok('Brand-Bold'),
        });
      })
      .catch(() => alive && setLoaded({}));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return loaded;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useConfig((s) => s.config.theme);
  const scheme = useColorScheme();
  const font = useBrandFonts();
  const dark = theme.mode === 'dark' || (theme.mode === 'auto' && scheme === 'dark');

  const value = useMemo<Theme>(
    () => ({
      c: dark ? theme.dark : theme.colors,
      dark,
      radius: theme.radius ?? 14,
      font,
      space: (n: number) => n * 4,
    }),
    [dark, theme, font]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
}

/** Adds alpha to a #RRGGBB color. */
export function alpha(hex: string, a: number) {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${v}`;
}
