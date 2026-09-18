import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useState } from 'react';
import { Screen, GlassCard } from '../src/components';
import { palette, typography, spacing } from '../src/theme';

export default function Settings() {
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(true);
  const [bio, setBio] = useState(true);
  const [location, setLocation] = useState(true);

  const Row = ({ label, value, onToggle }: any) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: palette.neon, false: palette.textDim }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <GlassCard>
          <Row label="Push Notifications" value={push} onToggle={setPush} />
          <Row label="SMS Alerts" value={sms} onToggle={setSms} />
        </GlassCard>

        <Text style={styles.sectionLabel}>PRIVACY & SECURITY</Text>
        <GlassCard>
          <Row label="Biometric Lock" value={bio} onToggle={setBio} />
          <Row label="Location Access" value={location} onToggle={setLocation} />
        </GlassCard>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <GlassCard>
          <Text style={styles.aboutLine}>GAIA Mobile</Text>
          <Text style={styles.aboutSub}>Version 1.0.0 · Build 1</Text>
          <Text style={styles.aboutSub}>Powered by Darkmoor Ltd</Text>
        </GlassCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginBottom: spacing.xl },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginVertical: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowLabel: { ...typography.body, color: palette.text, fontWeight: '600' },
  aboutLine: { ...typography.body, color: palette.text, fontWeight: '700' },
  aboutSub: { ...typography.caption, color: palette.textMuted, marginTop: 6 },
});
