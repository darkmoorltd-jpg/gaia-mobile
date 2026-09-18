import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';

export default function VerifyGate() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const FEATURES = [
    'Post unlimited listings',
    'Receive payments via wallet',
    'Escrow protection for every sale',
    'Verified seller badge on your profile',
    'Priority in search results',
  ];
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <Text style={styles.iconTxt}>LOCK</Text>
        </View>

        <Text style={styles.title}>Verify to become a Seller</Text>
        <Text style={styles.sub}>
          To protect buyers and keep GAIA safe, only verified farmers can sell.
        </Text>

        <View style={styles.featureBox}>
          <Text style={styles.featureLabel}>UNLOCKS</Text>
          {FEATURES.map((f, i) => (
            <Text key={i} style={styles.featureItem}>• {f}</Text>
          ))}
        </View>

        <View style={styles.feeBox}>
          <Text style={styles.feeLabel}>VERIFICATION FEE</Text>
          <Text style={styles.feeValue}>N2,000</Text>
          <Text style={styles.feeSub}>One-time · Lifetime access</Text>
        </View>

        <Pressable
          onPress={() => router.push('/verification' as any)}
          style={styles.cta}
        >
          <Text style={styles.ctaTxt}>START VERIFICATION</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 24, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 20 },
  iconCircle: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: p.neonSoft, borderWidth: 2, borderColor: p.borderHi,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
  },
  iconTxt: { fontSize: 16, fontWeight: '900', color: p.neon, letterSpacing: 2 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, textAlign: 'center', marginTop: 20, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: p.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  featureBox: {
    marginTop: 24, padding: 20, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  featureLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 10 },
  featureItem: { fontSize: 14, color: p.text, lineHeight: 24 },
  feeBox: {
    marginTop: 20, padding: 24, borderRadius: 16,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center',
  },
  feeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  feeValue: { fontSize: 40, fontWeight: '900', color: p.neon, marginTop: 4, letterSpacing: -1.5 },
  feeSub: { fontSize: 12, color: p.textMuted, marginTop: 6 },
  cta: {
    marginTop: 24, paddingVertical: 18, borderRadius: 14,
    backgroundColor: p.neon, alignItems: 'center',
  },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
