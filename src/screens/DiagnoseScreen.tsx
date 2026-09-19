import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image,
  Modal, FlatList, ActivityIndicator, ImageBackground, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, typography, spacing, radius } from '../theme';
import { useAuth } from '../store/auth';
import { supabase } from '../api/supabase';
import { diagnose, DiagnosisError } from '../api/models';

const { width } = Dimensions.get('window');

const BACKDROPS: Record<string, string> = {
  crops:     'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1200',
  pests:     'https://images.unsplash.com/photo-1590691566903-692bf5ca7493?w=1200',
  soil:      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200',
  livestock: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=1200',
};

export interface DiagnoseConfig {
  key: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  modelKey: string;
  options: { key: string; label: string; emoji?: string }[];
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

  const backdrop = BACKDROPS[config.key] || BACKDROPS.crops;

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshScans();
    } catch (e: any) {
      if (e instanceof DiagnosisError) {
        if (e.status === 402) setError('No scans left. Please buy more.');
        else setError(e.message);
      } else {
        setError(e?.message ?? 'Diagnosis failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // ----- RESULT VIEW -----
  if (result) {
    const top = result.top;
    const isHealthy = (top?.label || '').toLowerCase().includes('healthy');
    const accent = isHealthy ? palette.neon : palette.warning;

    return (
      <View style={styles.root}>
        <ImageBackground source={{ uri: backdrop }} style={styles.bg} imageStyle={{ opacity: 0.18 }}>
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)'] as any} style={styles.overlay}>
            <ScrollView contentContainerStyle={styles.scroll}>
              <Pressable onPress={() => setResult(null)}>
                <Text style={styles.back}>NEW SCAN</Text>
              </Pressable>

              <LinearGradient colors={[accent, accent + '99'] as any} style={styles.resultHero}>
                <Text style={styles.resultIcon}>{isHealthy ? '✓' : '!'}</Text>
                <Text style={styles.resultLabel}>{top?.label || 'Unknown'}</Text>
                <Text style={styles.resultConf}>
                  {typeof top?.confidence === 'number' ? top.confidence.toFixed(1) : '0'}% CONFIDENCE
                </Text>
              </LinearGradient>

              <Text style={styles.sectionLabel}>ALL PREDICTIONS</Text>
              {(result.predictions || []).slice(0, 8).map((p: any, i: number) => (
                <View key={i} style={styles.predCard}>
                  <View style={styles.predRow}>
                    <Text style={styles.predLabel}>{p.label}</Text>
                    <Text style={styles.predPct}>{p.confidence.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: (Math.min(p.confidence, 100) + '%') as any }]} />
                  </View>
                </View>
              ))}

              <Text style={styles.sectionLabel}>RECOMMENDED ACTIONS</Text>
              <View style={styles.actionsCard}>
                <Text style={styles.actionTitle}>Organic</Text>
                <Text style={styles.actionBody}>Apply neem oil spray at 5ml/L every 7 days.</Text>
                <View style={styles.divider} />
                <Text style={styles.actionTitle}>Chemical</Text>
                <Text style={styles.actionBody}>Mancozeb 80% WP at 2g/L. Spray in the evening.</Text>
                <View style={styles.divider} />
                <Text style={styles.actionTitle}>Water</Text>
                <Text style={styles.actionBody}>Avoid overhead irrigation to reduce leaf wetness.</Text>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  }

  // ----- INPUT VIEW -----
  return (
    <View style={styles.root}>
      <ImageBackground source={{ uri: backdrop }} style={styles.bg} imageStyle={{ opacity: 0.28 }}>
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)'] as any} style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>{config.title}</Text>
            <Text style={styles.title}>{config.emoji}  {config.subtitle}</Text>

            <View style={styles.scanBar}>
              <Text style={styles.scanText}>{scansRemaining} SCANS LEFT</Text>
            </View>

            <Pressable onPress={() => setShowPicker(true)} style={styles.selector}>
              <Text style={styles.selectorLabel}>{selected.label}</Text>
              <Text style={styles.selectorCaret}>v</Text>
            </Pressable>

            {imageUri ? (
              <View style={styles.previewBox}>
                <Image source={{ uri: imageUri }} style={styles.preview} />
              </View>
            ) : permission?.granted ? (
              <View style={styles.cameraBox}>
                <CameraView ref={cameraRef} style={styles.camera} facing="back" />
                <View style={styles.frameOverlay} />
                <Pressable onPress={shoot} style={styles.shutter}>
                  <View style={styles.shutterInner} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={requestCamera} style={styles.cameraBox}>
                <View style={styles.cameraPlaceholder}>
                  <Text style={styles.cameraIcon}>CAM</Text>
                  <Text style={styles.cameraHint}>TAP TO OPEN CAMERA</Text>
                </View>
              </Pressable>
            )}

            <View style={styles.actionRow}>
              <Pressable onPress={pickFromGallery} style={styles.actionBtn}>
                <Text style={styles.actionBtnLabel}>ALBUM</Text>
              </Pressable>
              <Pressable onPress={requestCamera} style={styles.actionBtn}>
                <Text style={styles.actionBtnLabel}>CAMERA</Text>
              </Pressable>
              <Pressable onPress={() => { setImageUri(null); setResult(null); }} style={styles.actionBtn}>
                <Text style={styles.actionBtnLabel}>RESET</Text>
              </Pressable>
            </View>

            {imageUri ? (
              <Pressable onPress={analyze} disabled={loading} style={styles.cta}>
                {loading
                  ? <ActivityIndicator color={palette.obsidian} />
                  : <Text style={styles.ctaText}>ANALYZE WITH AI</Text>}
              </Pressable>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>TIPS</Text>
              <Text style={styles.tip}>Use natural daylight</Text>
              <Text style={styles.tip}>Fill the frame with one leaf or subject</Text>
              <Text style={styles.tip}>Avoid shadows and blur</Text>
            </View>

            <View style={{ height: 140 }} />
          </ScrollView>
        </LinearGradient>
      </ImageBackground>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowPicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>SELECT {config.title}</Text>
            <FlatList
              data={config.options}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setSelected(item); setShowPicker(false); }}
                  style={[styles.modalItem, selected.key === item.key && styles.modalItemActive]}
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
  root: { flex: 1, backgroundColor: p.obsidian },
  bg: { flex: 1 },
  overlay: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon, marginBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 6 },
  scanBar: {
    marginTop: 18, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: p.borderHi,
    alignSelf: 'flex-start',
  },
  scanText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, padding: 16, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: p.border,
  },
  selectorLabel: { fontSize: 15, color: '#fff', fontWeight: '700' },
  selectorCaret: { color: p.neon, fontWeight: '900', fontSize: 14 },
  cameraBox: {
    marginTop: 16, aspectRatio: 1, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#000', borderWidth: 1, borderColor: p.borderHi, position: 'relative',
  },
  camera: { flex: 1 },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  cameraIcon: { fontSize: 22, color: p.neon, fontWeight: '900', letterSpacing: 3 },
  cameraHint: { fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, fontWeight: '700' },
  frameOverlay: {
    position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
    borderWidth: 2, borderColor: p.neon, borderRadius: 20, opacity: 0.8,
  },
  shutter: {
    position: 'absolute', bottom: 22, left: '50%', marginLeft: -36,
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 3, borderColor: p.neon,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: p.neon },
  previewBox: {
    marginTop: 16, aspectRatio: 1, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: p.borderHi,
  },
  preview: { flex: 1, resizeMode: 'cover' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: p.border,
    alignItems: 'center',
  },
  actionBtnLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#fff' },
  cta: {
    marginTop: 16, paddingVertical: 20, borderRadius: 16,
    backgroundColor: p.neon, alignItems: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  error: { color: p.danger, textAlign: 'center', marginTop: 12, fontSize: 13 },
  tips: {
    marginTop: 22, padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  tipsTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon, marginBottom: 8 },
  tip: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  resultHero: { borderRadius: 24, padding: 32, alignItems: 'center', marginTop: 8 },
  resultIcon: { fontSize: 60, color: '#000', fontWeight: '900' },
  resultLabel: { fontSize: 24, fontWeight: '900', color: '#000', marginTop: 8, textAlign: 'center' },
  resultConf: { fontSize: 11, letterSpacing: 1.5, fontWeight: '800', color: '#000', marginTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', marginTop: 22, marginBottom: 10 },
  predCard: {
    padding: 14, borderRadius: 14, marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: p.border,
  },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  predLabel: { fontSize: 14, color: '#fff', fontWeight: '600', flex: 1 },
  predPct: { fontSize: 14, color: p.neon, fontWeight: '900' },
  barBg: { height: 6, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 3 },
  actionsCard: {
    padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: p.border,
  },
  actionTitle: { fontSize: 14, color: p.neon, fontWeight: '800' },
  actionBody: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 19 },
  divider: { height: 1, backgroundColor: p.border, marginVertical: 12 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 22, maxHeight: '70%', borderTopWidth: 1, borderColor: p.borderHi,
  },
  modalTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', marginBottom: 14 },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 14, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalItemActive: { backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi },
  modalLabel: { fontSize: 15, color: '#fff', fontWeight: '600', flex: 1 },
  modalCheck: { color: p.neon, fontSize: 18, fontWeight: '900' },
});
