import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ImageBackground, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

const CROPS = [
  { key: 'maize',    label: 'Maize' },
  { key: 'rice',     label: 'Rice' },
  { key: 'cassava',  label: 'Cassava' },
  { key: 'tomato',   label: 'Tomato' },
  { key: 'pepper',   label: 'Pepper' },
  { key: 'cabbage',  label: 'Cabbage' },
  { key: 'soybean',  label: 'Soybean' },
  { key: 'wheat',    label: 'Wheat' },
];

export default function CropsTab() {
  const { palette } = useTheme();
  const { scansRemaining } = useAuth();
  const styles = createStyles(palette);
  const [selected, setSelected] = useState('maize');
  const [busy, setBusy] = useState(false);

  const analyze = () => {
    setBusy(true);
    setTimeout(() => setBusy(false), 1500);
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200' }}
        style={styles.bg}
        imageStyle={{ opacity: 0.35 }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)'] as any}
          style={styles.overlay}
        >
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>SOIL ANALYSIS</Text>
            <Text style={styles.title}>Know your soil</Text>
            <Text style={styles.subtitle}>Identify 11 soil types from a single photo.</Text>

            <View style={styles.scanBox}>
              <Text style={styles.scanLabel}>SCANS</Text>
              <Text style={styles.scanVal}>{scansRemaining}</Text>
            </View>

            <Text style={styles.section}>SELECT CROP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CROPS.map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setSelected(c.key)}
                    style={[styles.chip, selected === c.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected === c.key && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable onPress={analyze} style={styles.cta} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.ctaText}>OPEN CAMERA</Text>}
            </Pressable>

            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>TIPS</Text>
              <Text style={styles.tip}>• Use natural daylight</Text>
              <Text style={styles.tip}>• Fill the frame with one leaf</Text>
              <Text style={styles.tip}>• Avoid shadows and blur</Text>
            </View>

            <View style={{ height: 140 }} />
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  bg: { flex: 1, backgroundColor: p.obsidian },
  overlay: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 6, marginBottom: 20 },
  scanBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: p.borderHi, alignSelf: 'flex-start' },
  scanLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  scanVal: { fontSize: 16, fontWeight: '900', color: '#fff' },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', marginTop: 20, marginBottom: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  chipTextActive: { color: p.obsidian },
  cta: { padding: 20, borderRadius: 16, backgroundColor: p.neon, alignItems: 'center', marginTop: 12 },
  ctaText: { fontSize: 16, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  tips: { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tipsTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon, marginBottom: 8 },
  tip: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
});
