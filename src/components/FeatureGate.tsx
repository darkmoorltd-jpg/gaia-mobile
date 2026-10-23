import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../store/settings';
import { useTheme } from '../theme';

interface Props {
  flag: string;
  children: React.ReactNode;
}

function FeatureGate({ flag, children }: Props) {
  const flags = useSettings((s) => s.flags);
  const loaded = useSettings((s) => s.loaded);
  const { palette } = useTheme();

  if (!loaded) return null;

  const on = flags[flag] === undefined ? true : !!flags[flag];
  if (on) return <>{children}</>;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.obsidian }]}>
      <Text style={[styles.title, { color: palette.text }]}>Temporarily unavailable</Text>
      <Text style={[styles.sub, { color: palette.textMuted }]}>
        This feature has been disabled by the administrator.
        Please try again later.
      </Text>
    </View>
  );
}

// HOC: wrap a whole screen. Use as:
//   export default gateScreen('wallet', WalletScreen);
export function gateScreen<P extends object>(
  flag: string,
  Screen: React.ComponentType<P>
): React.ComponentType<P> {
  return function Gated(props: P) {
    return (
      <FeatureGate flag={flag}>
        <Screen {...props} />
      </FeatureGate>
    );
  };
}

// Helper for menu filtering
export function flagAllows(flags: Record<string, boolean>, flag: string | undefined | null): boolean {
  if (!flag) return true;
  const v = flags[flag];
  return v === undefined ? true : !!v;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  title: { fontSize: 20, fontWeight: '900', marginBottom: 10 },
  sub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
export default FeatureGate;
