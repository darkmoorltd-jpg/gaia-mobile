import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useTheme, spacing } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { diagnose } from '../src/api/models';

export default function VideoScan() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user, refreshScans } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [error, setError] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const stopFlag = useRef(false);

  const startScan = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setError('Camera permission required');
        return;
      }
    }
    setScanning(true);
    setDetections([]);
    setError('');
    stopFlag.current = false;

    // Capture a frame every 2 seconds, send to /diagnose, keep going
    const tick = async () => {
      if (stopFlag.current) return;
      try {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
        if (photo?.uri) {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token ?? '';
          const res = await diagnose(photo.uri, 'maize', token);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setDetections((prev) => [
            { label: res.top.label, conf: res.top.confidence, at: new Date().toLocaleTimeString() },
            ...prev.slice(0, 6),
          ]);
          try { await refreshScans(); } catch {}
        }
      } catch (e: any) {
        setError(e?.message ?? 'Scan failed');
      }
      if (!stopFlag.current) setTimeout(tick, 2000);
    };
    tick();
  };

  const stopScan = () => {
    stopFlag.current = true;
    setScanning(false);
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
        {scanning ? (
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.detectionLabel}>{d.label}</Text>
                  <Text style={styles.detectionTime}>{d.at}</Text>
                </View>
                <Text style={styles.detectionConf}>{d.conf.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            Hold steady over a leaf. GAIA captures a frame every 2 seconds and flags problems in real time.
          </Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={scanning ? stopScan : startScan}
          style={[styles.cta, scanning && styles.ctaStop]}
        >
          {scanning
            ? <Text style={styles.ctaText}>STOP SCAN</Text>
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
  cameraWrap: {
    marginHorizontal: 20, aspectRatio: 3 / 4, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#000', borderWidth: 2, borderColor: p.borderHi, position: 'relative',
  },
  camera: { flex: 1 },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: p.textMuted },
  frame: {
    position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
    borderWidth: 2, borderColor: p.neon, borderRadius: 20, opacity: 0.8,
  },
  recBadge: {
    position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center',
    gap: 6, backgroundColor: 'rgba(255,60,90,0.9)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1.2 },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  detectionsBox: {
    padding: 16, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  detectionsTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon, marginBottom: 10 },
  detectionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border,
  },
  detectionLabel: { fontSize: 14, color: p.text, fontWeight: '600' },
  detectionTime: { fontSize: 10, color: p.textDim, marginTop: 2 },
  detectionConf: { fontSize: 14, color: p.neon, fontWeight: '900' },
  hint: { fontSize: 14, lineHeight: 22, color: p.textMuted, textAlign: 'center', marginTop: 20 },
  error: { color: p.danger, textAlign: 'center', marginTop: 12, fontSize: 13 },
  cta: { padding: 20, borderRadius: 16, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaStop: { backgroundColor: p.danger },
  ctaText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
