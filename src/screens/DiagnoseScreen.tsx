import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image,
  Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, typography, spacing, radius } from '../theme';
import { useAuth } from '../store/auth';
import { supabase } from '../api/supabase';
import { diagnose, DiagnosisError } from '../api/models';

export interface DiagnoseConfig {
  key: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  modelKey: string;
  options: { key: string; label: string }[];
  contextType: 'crop' | 'pest' | 'soil' | 'livestock';
}

export function DiagnoseScreen({ config }: { config: DiagnoseConfig }) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user, scansRemaining, refreshScans } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [selected, setSelected] = useState(config.options[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const cameraRef = useRef<CameraView>(null);

  const requestCamera = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setError('Camera permission required');
        return false;
      }
    }
    return true;
  };

  const shoot = async () => {
    if (!(await requestCamera())) return;
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setImageUri(photo.uri);
        setResult(null);
        setError('');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Capture failed');
    }
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled) {
      setImageUri(res.assets[0].uri);
      setResult(null);
      setError('');
    }
  };

  const analyze = async () => {
    if (!imageUri || !user) return;
    if (scansRemaining <= 0) {
      setError('No scans left. Buy more to continue.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) throw new Error('Session expired — please log in again');

      const res = await diagnose(imageUri, selected.key, token);
      setResult(res);
      await refreshScans();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const msg = e instanceof DiagnosisError ? e.message : (e?.message ?? 'Diagnosis failed');
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RESULT VIEW
  // ============================================
  if (result) {
    const top = result.top;
    const healthy = top.label.toLowerCase().includes('healthy');
    const accent = healthy ? palette.neon : palette.warning;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <LinearGradient colors={[accent, accent + 'CC'] as any} style={styles.resultHero}>
            <Text style={styles.resultEmoji}>{healthy ? '✓' : '!'}</Text>
            <Text style={styles.resultLabel}>{top.label}</Text>
            <Text style={styles.resultConfidence}>{top.confidence.toFixed(1)}% CONFIDENCE</Text>
          </LinearGradient>

          <Text style={styles.resultMetaText}>
            {result.processingMs} ms · {result.scansRemaining} scans left
          </Text>

          {result.gradcamBase64 ? (
            <View>
              <Text style={styles.sectionLabel}>WHAT AI SAW</Text>
              <Image
                source={{ uri: 'data:image/png;base64,' + result.gradcamBase64 }}
                style={styles.gradcam}
              />
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>ALL PREDICTIONS</Text>
          {result.predictions.map((p: any, i: number) => (
            <View key={i} style={styles.predRow}>
              <View style={styles.predHeader}>
                <Text style={styles.predLabel}>{p.label}</Text>
                <Text style={styles.predPct}>{p.confidence.toFixed(1)}%</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${Math.min(p.confidence, 100)}%` as any }]} />
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => { setResult(null); setImageUri(null); }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>NEW SCAN</Text>
          </Pressable>

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    );
  }

  // ============================================
  // CAPTURE VIEW
  // ============================================
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.kicker, { color: config.color }]}>{config.title}</Text>
        <Text style={styles.title}>{config.emoji} {config.subtitle}</Text>

        <View style={styles.scanBox}>
          <Text style={styles.scanLabel}>SCANS</Text>
          <Text style={styles.scanVal}>{scansRemaining}</Text>
        </View>

        <Pressable onPress={() => setShowPicker(true)} style={styles.selector}>
          <Text style={styles.selectorLabel}>{selected.label}</Text>
          <Text style={styles.selectorCaret}>▼</Text>
        </Pressable>

        {imageUri ? (
          <View style={styles.previewBox}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
          </View>
        ) : permission?.granted ? (
          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.frame} />
            <Pressable onPress={shoot} style={styles.shutter}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={requestCamera} style={styles.cameraBox}>
            <View style={styles.cameraPlaceholder}>
              <Text style={{ fontSize: 48 }}>📷</Text>
              <Text style={styles.cameraHint}>TAP TO OPEN CAMERA</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.actionRow}>
          <Pressable onPress={pickFromGallery} style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>🖼</Text>
            <Text style={styles.actionBtnLabel}>ALBUM</Text>
          </Pressable>
          <Pressable onPress={requestCamera} style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>📸</Text>
            <Text style={styles.actionBtnLabel}>CAMERA</Text>
          </Pressable>
          <Pressable
            onPress={() => { setImageUri(null); setResult(null); setError(''); }}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnIcon}>↺</Text>
            <Text style={styles.actionBtnLabel}>RESET</Text>
          </Pressable>
        </View>

        {imageUri ? (
          <Pressable
            onPress={analyze}
            disabled={loading}
            style={[styles.cta, loading && { opacity: 0.6 }]}
          >
            {loading
              ? <ActivityIndicator color={palette.obsidian} />
              : <Text style={styles.ctaText}>ANALYZE WITH AI</Text>}
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.modalBg} onPress={() => setShowPicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>SELECT {config.title}</Text>
            <FlatList
              data={config.options}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setSelected(item); setShowPicker(false); }}
                  style={[
                    styles.modalItem,
                    selected.key === item.key && styles.modalItemActive,
                  ]}
                >
                  <Text style={styles.modalLabel}>{item.label}</Text>
                  {selected.key === item.key && <Text style={styles.modalCheck}>✓</Text>}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -0.8 },
  scanBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: p.neonSoft,
    borderWidth: 1,
    borderColor: p.border,
    alignSelf: 'flex-start',
  },
  scanLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted },
  scanVal: { fontSize: 16, fontWeight: '900', color: p.neon },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    marginTop: 14,
  },
  selectorLabel: { fontSize: 15, fontWeight: '700', color: p.text },
  selectorCaret: { color: p.textMuted, fontSize: 12 },
  cameraBox: {
    marginTop: 16,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: p.abyss,
    borderWidth: 1,
    borderColor: p.border,
    position: 'relative',
  },
  camera: { flex: 1 },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cameraHint: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: p.textMuted },
  frame: {
    position: 'absolute',
    top: '20%', left: '20%', right: '20%', bottom: '20%',
    borderWidth: 2,
    borderColor: p.neon,
    borderRadius: 20,
    opacity: 0.6,
  },
  shutter: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 3, borderColor: p.neon,
    alignItems: 'center', justifyContent: 'center',
    left: '50%', marginLeft: -36,
  },
  shutterInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: p.neon,
  },
  previewBox: {
    marginTop: 16,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: p.borderHi,
  },
  preview: { flex: 1, resizeMode: 'cover' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: 'center',
  },
  actionBtnIcon: { fontSize: 20 },
  actionBtnLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: p.text, marginTop: 4 },
  cta: {
    marginTop: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor: p.neon,
    alignItems: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  error: { color: p.danger, textAlign: 'center', marginTop: 14, fontSize: 13 },
  // Result
  resultHero: { borderRadius: 24, padding: 32, alignItems: 'center', marginTop: 20 },
  resultEmoji: { fontSize: 56, color: '#000', fontWeight: '900' },
  resultLabel: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    marginTop: 12,
    textAlign: 'center',
  },
  resultConfidence: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#000', marginTop: 8 },
  resultMetaText: {
    fontSize: 12,
    color: p.textMuted,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: p.textMuted,
    marginTop: 20,
    marginBottom: 12,
  },
  gradcam: { width: '100%', aspectRatio: 1, borderRadius: 16 },
  predRow: { marginBottom: 14 },
  predHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  predLabel: { fontSize: 14, fontWeight: '600', color: p.text, flex: 1 },
  predPct: { fontSize: 14, fontWeight: '800', color: p.neon },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(0,255,136,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 3 },
  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: p.abyss,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: p.borderHi,
  },
  modalTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 16 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: p.surface,
  },
  modalItemActive: { backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi },
  modalLabel: { fontSize: 15, fontWeight: '600', color: p.text },
  modalCheck: { color: p.neon, fontSize: 18, fontWeight: '900' },
});
