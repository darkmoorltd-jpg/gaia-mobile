import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { useState } from 'react';
import { useTheme, typography, spacing, radius } from '../src/theme';

export default function Settings() {
  const { palette, mode, setMode } = useTheme();
  const styles = createStyles(palette);
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>Dark mode</Text>
              <Text style={styles.rowHint}>Currently {mode === 'dark' ? 'ON' : 'OFF'}</Text>
            </View>
            <Switch
              value={mode === 'dark'}
              onValueChange={(v) => setMode(v ? 'dark' : 'light')}
              trackColor={{ true: palette.neon, false: palette.textDim }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <Row label="Push Notifications" value={push} onToggle={setPush} />
          <Row label="SMS Alerts" value={sms} onToggle={setSms} />
        </View>

        <Text style={styles.sectionLabel}>PRIVACY AND SECURITY</Text>
        <View style={styles.card}>
          <Row label="Biometric Lock" value={bio} onToggle={setBio} />
          <Row label="Location Access" value={location} onToggle={setLocation} />
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.aboutLine}>GAIA Mobile</Text>
          <Text style={styles.aboutSub}>Version 1.0.0</Text>
          <Text style={styles.aboutSub}>Powered by Darkmoor Ltd</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginBottom: spacing.xl },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowLabel: { ...typography.body, color: palette.text, fontWeight: '600' },
  rowHint: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
  aboutLine: { ...typography.body, color: palette.text, fontWeight: '700', paddingTop: spacing.md },
  aboutSub: { ...typography.caption, color: palette.textMuted, marginTop: 6, paddingBottom: spacing.sm },
});
