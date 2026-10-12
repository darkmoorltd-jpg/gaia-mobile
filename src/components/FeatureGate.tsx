import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../store/settings';
import { useTheme } from '../theme';

interface Props {
  flag: string;
  children: React.ReactNode;
}

export default function FeatureGate({ flag, children }: Props) {
  const flags = useSettings((s) => s.flags);
  const loaded = useSettings((s) => s.loaded);
  const { palette } = useTheme();

  // While loading, render nothing (root splash already covers this)
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

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  title: { fontSize: 20, fontWeight: '900', marginBottom: 10 },
  sub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
