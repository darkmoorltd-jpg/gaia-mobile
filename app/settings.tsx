import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { useState } from 'react';
import { Screen, GlassCard } from '../src/components';
import { useTheme } from '../src/theme/ThemeContext';
import { typography, spacing } from '../src/theme';

export default function Settings() {
  const { palette, shadows, mode, toggle } = useTheme();

  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(true);
  const [bio, setBio] = useState(true);
  const [location, setLocation] = useState(true);

  const Row = ({ label, value, onToggle }: any) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: palette.neon, false: palette.textDim }}
        thumbColor={'#fff'}
      />
    </View>
  );

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>

        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>APPEARANCE</Text>
        <GlassCard>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>Theme</Text>
              <Text style={[styles.rowSub, { color: palette.textMuted }]}>
                {mode === 'dark' ? 'Obsidian Neon' : 'Ivory Emerald'}
              </Text>
            </View>
            <Switch
              value={mode === 'light'}
              onValueChange={toggle}
              trackColor={{ true: palette.neon, false: palette.textDim }}
              thumbColor={'#fff'}
            />
          </View>
        </GlassCard>

        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>NOTIFICATIONS</Text>
        <GlassCard>
          <Row label="Push Notifications" value={push} onToggle={setPush} />
          <Row label="SMS Alerts" value={sms} onToggle={setSms} />
        </GlassCard>

        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>PRIVACY & SECURITY</Text>
        <GlassCard>
          <Row label="Biometric Lock" value={bio} onToggle={setBio} />
          <Row label="Location Access" value={location} onToggle={setLocation} />
        </GlassCard>

        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>ABOUT</Text>
        <GlassCard>
          <Text style={[styles.aboutLine, { color: palette.text }]}>GAIA Mobile</Text>
          <Text style={[styles.aboutSub, { color: palette.textMuted }]}>Version 1.0.0</Text>
          <Text style={[styles.aboutSub, { color: palette.textMuted }]}>
            Powered by Darkmoor Ltd
          </Text>
        </GlassCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: spacing.xl },
  sectionLabel: { ...typography.micro, marginVertical: spacing.md },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowLabel: { ...typography.body, fontWeight: '600' },
  rowSub: { ...typography.micro, margin,
Top: 2 },
  aboutLine: { ...typography.body       , fontWeight: '700' },
  about borderRadius:Sub: { ... radiustypography.caption, marginTop: 6 },
});
