
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen, GlassCard, NeonButton } from '../src/components';
import { palette, typography, spacing } from '../src/theme';

export default function Help() {
  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Help</Text>
        <Text style={styles.subtitle}>We're here when you need us.</Text>

        <GlassCard style={{ marginTop: spacing.xl }}>
          <Text style={styles.cardTitle}>🆘 Contact Support</Text>
          <Text style={styles.cardBody}>Average response time: 2 hours</Text>
          <NeonButton label="OPEN TICKET" onPress={() => {}} style={{ marginTop: spacing.md }} />
        </GlassCard>

        <GlassCard style={{ marginTop: spacing.md }}>
          <Text style={styles.cardTitle}>💬 WhatsApp</Text>
          <Text style={styles.cardBody}>+234 705 464 7903</Text>
          <NeonButton label="CHAT NOW" variant="ghost" onPress={() => {}} style={{ marginTop: spacing.md }} />
        </GlassCard>

        <GlassCard style={{ marginTop: spacing.md }}>
          <Text style={styles.cardTitle}>📧 Email</Text>
          <Text style={styles.cardBody}>darkmoorltd@gmail.com</Text>
        </GlassCard>

        <Text style={styles.sectionLabel}>FAQ</Text>
        <GlassCard>
          <Text style={styles.faq}>• How do scans work?</Text>
          <Text style={styles.faq}>• How do I get more scans?</Text>
          <Text style={styles.faq}>• Is my data secure?</Text>
          <Text style={styles.faq}>• How do I verify my account?</Text>
          <Text style={styles.faq}>• Can I use GAIA offline?</Text>
        </GlassCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  cardTitle: { ...typography.body, color: palette.text, fontWeight: '800' },
  cardBody: { ...typography.body, color: palette.textMuted, marginTop: 6 },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xl, marginBottom: spacing.md },
  faq: { ...typography.body, color: palette.textMuted, marginBottom: spacing.md },
});
