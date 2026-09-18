import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme, spacing, radius, typography } from '../src/theme';

export default function VideoScan() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const start = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) return;
    }
    setRecording(true);
    setDetections([]);

    // Simulated detections during scan
    const demo = [
      { label: 'Leaf Blight', conf: 91.2 },
      { label: 'Healthy tissue', conf: 84.7 },
      { label: 'Possible rust', conf: 76.1 },
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < demo.length) {
        setDetections((d) => [...d, demo[i]]);
        i++;
      }
    }, 900);

    setTimeout(() => {
      clearInterval(interval);
      setRecording(false);
    }, 3500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>LIVE FIELD SCAN</Text>
        <Text style={styles.title}>Point at your crops</Text>
      </View>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        ) : (
          <View style={styles.cameraFallback}>
            <Text style={styles.fallbackText}>Camera permission required</Text>
          </View>
        )}
        <View style={styles.frame} />
        {recording ? (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>SCANNING</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {detections.length > 0 ? (
          <View style={styles.detectionsBox}>
            <Text style={styles.detectionsTitle}>LIVE DETECTIONS</Text>
            {detections.map((d, i) => (
              <View key={i} style={styles.detectionRow}>
                <Text style={styles.detectionLabel}>{d.label}</Text>
                <Text style={styles.detectionConf}>{d.conf}%</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            Hold steady over a leaf. GAIA scans continuously and flags problems in real time.
          </Text>
        )}

        <Pressable onPress={start} style={styles.cta} disabled={recording || busy}>
          {busy || recording
            ? <ActivityIndicator color={palette.obsidian} />
            : <Text style={styles.ctaText}>START SCAN</Text>}
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  cameraWrap: { marginHorizontal: 20, aspectRatio: 3 / 4, borderRadius: 24, overflow: 'hidden', backgroundColor: p.abyss, borderWidth: 2, borderColor: p.borderHi, position: 'relative' },
  camera: { flex: 1 },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: p.textMuted },
  frame: { position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', borderWidth: 2, borderColor: p.neon, borderRadius: 20, opacity: 0.8 },
  recBadge: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,60,90,0.9)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1.2 },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  detectionsBox: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  detectionsTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon, marginBottom: 10 },
  detectionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.border },
  detectionLabel: { fontSize: 14, color: p.text, fontWeight: '600' },
  detectionConf: { fontSize: 14, color: p.neon, fontWeight: '900' },
  hint: { fontSize: 14, lineHeight: 22, color: p.textMuted, textAlign: 'center', marginTop: 20 },
  cta: { padding: 20, borderRadius: 16, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 16, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
