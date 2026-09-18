
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen, GlassCard, Pill } from '../src/components';
import { typography, spacing } from '../src/theme';
import { useTheme } from '../src/theme';

const NOTIFS = [
  { icon: '🌿', title: 'Diagnosis Complete', body: 'Northern Leaf Blight · 89%', time: '2 minutes ago' },
  { icon: '⚠', title: 'Weather Alert', body: 'Heavy rain in Kaduna in 48 hours', time: '1 hour ago' },
  { icon: '💰', title: 'Payment Received', body: '₦5,000 — Pro Plan', time: '3 hours ago' },
  { icon: '🛡', title: 'Verification Approved', body: 'You can now access wallet', time: 'Yesterday' },
  { icon: '🎓', title: 'Course Milestone', body: 'You completed Module 7', time: 'Yesterday' },
];

export default function Notifications() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Inbox" />
        <Text style={styles.title}>Notifications</Text>

        {NOTIFS.map((n, i) => (
          <View key={i} style={{ marginBottom: spacing.md }}>
            <GlassCard>
              <View style={styles.row}>
                <Text style={styles.icon}>{n.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titleText}>{n.title}</Text>
                  <Text style={styles.bodyText}>{n.body}</Text>
                  <Text style={styles.timeText}>{n.time}</Text>
                </View>
              </View>
            </GlassCard>
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm, marginBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md },
  icon: { fontSize: 26 },
  titleText: { ...typography.body, color: palette.text, fontWeight: '700' },
  bodyText: { ...typography.body, color: palette.textMuted, marginTop: 4 },
  timeText: { ...typography.micro, color: palette.textDim, marginTop: 6 },
});
