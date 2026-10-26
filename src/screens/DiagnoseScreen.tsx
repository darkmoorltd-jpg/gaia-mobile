import React, { useRef, useState, useEffect } from 'react';
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
import { logScan } from '../utils/scanLog';
import { getSession, runModel, softmax, imageUriToTensor, ensureModel, getLabels } from '../utils/onDeviceModel';
import ConfettiBurst from '../components/ConfettiBurst';
import { playSound, primeSounds } from '../utils/sounds';
import { success as hapticSuccess, warn as hapticWarn, error as hapticError, tap as hapticTap } from '../utils/haptics';
import { MarkdownOutput } from '../components/MarkdownOutput';
import AskGaiaPanel from '../components/AskGaiaPanel';
import { useTranslation } from 'react-i18next';


// ============================================================
// On-device diagnostics
// ============================================================
const ON_DEVICE_MAP: Record<string, { key: string; H: number; W: number; labels: string[] } | undefined> = {
  // pests
  pests_102class: { key: 'pests_102class_v2', H: 224, W: 224, labels: [] },
  millet: { key: 'millet', H: 224, W: 224, labels: [] },
  cotton: { key: 'cotton', H: 224, W: 224, labels: [] },
  okra: { key: 'okra', H: 224, W: 224, labels: [] },
  groundnut: { key: 'groundnut', H: 224, W: 224, labels: [] },
  // soil
  soil_11class:   { key: 'soil_11class',   H: 384, W: 384, labels: [] },
  // livestock — server still uses 'cattle'/'poultry'; we ship poultry on-device
  poultry:        { key: 'poultry',        H: 224, W: 224, labels: [] },
  pineapple:      { key: 'pineapple',      H: 224, W: 224, labels: [] },
  potato:         { key: 'potato',         H: 224, W: 224, labels: [] },
  soybean:        { key: 'soybean',        H: 224, W: 224, labels: [] },
};

async function onDeviceDiagnose(imageUri: string, modelKey: string): Promise<any | null> {
  try {
    const meta = ON_DEVICE_MAP[modelKey];
    if (!meta) return null;

    const sess = await getSession(meta.key);
    if (!sess) {
      console.log('[diagnose] on-device ORT not available — will use server');
      return null;
    }

    const tensor = await imageUriToTensor(imageUri, meta.H, meta.W);
    if (!tensor) return null;

    const t0 = Date.now();
    const out = await runModel(meta.key, tensor, meta.H, meta.W);
    if (!out) return null;

    const probs = softmax(out.logits);
    const topIdx = probs.indexOf(Math.max(...probs));
    const labels = meta.labels.length ? meta.labels : probs.map((_, i) => 'Class ' + i);

    const predictions = probs
      .map((p, i) => ({ label: labels[i] || ('Class ' + i), confidence: p * 100 }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    return {
      predictions,
      top: predictions[0],
      model: meta.key + ' (on-device)',
      processingMs: Date.now() - t0,
    };
  } catch (e) {
    console.warn('[diagnose] on-device failed silently:', e);
    return null;
  }
}

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
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user, scansRemaining, refreshScans } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [selected, setSelected] = useState(config.options[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const labels = await getLabels('pests_102class_v2');
      if (labels.length > 0 && ON_DEVICE_MAP.pests_102class) {
        ON_DEVICE_MAP.pests_102class.labels = labels;
      }
    })();
  }, []);

  // Load millet labels
  useEffect(() => {
    (async () => {
      try {
        const labels = await getLabels('millet');
        if (labels.length > 0 && ON_DEVICE_MAP.millet) {
          ON_DEVICE_MAP.millet.labels = labels;
          console.log('[diagnose] loaded', labels.length, 'millet labels');
        }
      } catch (e) {
        console.warn('[diagnose] millet labels failed', e);
      }
    })();
  }, []);

  // Load cotton labels
  useEffect(() => {
    (async () => {
      try {
        const labels = await getLabels('cotton');
        if (labels.length > 0 && ON_DEVICE_MAP.cotton) {
          ON_DEVICE_MAP.cotton.labels = labels;
          console.log('[diagnose] loaded', labels.length, 'cotton labels');
        }
      } catch (e) {
        console.warn('[diagnose] cotton labels failed', e);
      }
    })();
  }, []);

  // Load okra labels
  useEffect(() => {
    (async () => {
      try {
        const labels = await getLabels('okra');
        if (labels.length > 0 && ON_DEVICE_MAP.okra) {
          ON_DEVICE_MAP.okra.labels = labels;
          console.log('[diagnose] loaded', labels.length, 'okra labels');
        }
      } catch (e) {
        console.warn('[diagnose] okra labels failed', e);
      }
    })();
  }, []);

  // Load groundnut labels
  useEffect(() => {
    (async () => {
      try {
        const labels = await getLabels('groundnut');
        if (labels.length > 0 && ON_DEVICE_MAP.groundnut) {
          ON_DEVICE_MAP.groundnut.labels = labels;
          console.log('[diagnose] loaded', labels.length, 'groundnut labels');
        }
      } catch (e) {
        console.warn('[diagnose] groundnut labels failed', e);
      }
    })();
  }, []);
  const [result, setResult] = useState<any | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [confettiFire, setConfettiFire] = React.useState(false);
  React.useEffect(() => { primeSounds(); }, []);

  const [error, setError] = useState('');
  const cameraRef = useRef<CameraView>(null);

  // Load pest labels (102 class names) on mount
  useEffect(() => {
    (async () => {
      try {
        const labels = await getLabels('pests_102class_v2');
        if (labels.length > 0 && ON_DEVICE_MAP.pests_102class) {
          ON_DEVICE_MAP.pests_102class.labels = labels;
          console.log('[diagnose] loaded', labels.length, 'pest labels');
        }
      } catch (e) {
        console.warn('[diagnose] labels load failed', e);
      }
    })();
  }, []);


  const backdrop = BACKDROPS[config.key] || BACKDROPS.crops;

  const requestCamera = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setError(t('diagnose.cameraPermission'));
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
      setError(e?.message ?? t('diagnose.captureFailed'));
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
      setError(t('diagnose.noScansBuyMore'));
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) throw new Error(t('diagnose.sessionExpired'));      let res: any = null;

      // Try on-device first — any failure is silent, we fall back to server
      try {
        const od = await onDeviceDiagnose(imageUri, selected.key);
        if (od) res = od;
      } catch (e: any) {
        console.warn('[diagnose] on-device threw — falling back to server', e);
      }
      if (!res || !res.recommendations) {
        res = await diagnose(imageUri, selected.key, token);
      }

      setResult(res);

      // Persist to scan_history (non-blocking)
      try {
        const sid = await logScan({
          type: (config.key as any) || 'crops',
          model_key: selected.key,
          top_label: res.top?.label || 'Unknown',
          confidence: res.top?.confidence || 0,
          all_predictions: res.predictions || [],
          image_uri: imageUri,
          on_device: (res.model || '').toLowerCase().includes('on-device'),
          inference_ms: res.processingMs || 0,
          follow_up_of: null,
        });
        if (sid) setScanId(sid);
      } catch (e) {
        console.warn('[diagnose] scan log failed', e);
      }

      const healthy = (res?.top?.label || '').toLowerCase().includes('healthy');
      if (healthy) {
        hapticSuccess();
        playSound('success');
        setConfettiFire(false);
        setTimeout(() => setConfettiFire(true), 30);
      } else {
        hapticWarn();
        playSound('error');
      }
      await refreshScans();
    } catch (e: any) {
      hapticError();
      if (e instanceof DiagnosisError) {
        if (e.status === 402) setError(t('diagnose.noScans'));
        else setError(e.message);
      } else {
        setError(e?.message ?? t('diagnose.diagnosisFailed'));
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
          <ConfettiBurst fire={confettiFire} origin="top" />
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

              <Text style={styles.sectionLabel}>GAIA'S ACTION PLAN</Text>
              {result.recommendations ? (
                <View style={styles.adviceCard}>
                  <MarkdownOutput content={result.recommendations} />
                </View>
              ) : (
                <View style={styles.adviceCard}>
                  <ActivityIndicator color={palette.neon} />
                  <Text style={styles.adviceLoading}>Preparing your action plan…</Text>
                </View>
              )}

              <AskGaiaPanel
                disease={top?.label || ''}
                cropLabel={selected.label}
                contextType={config.contextType || 'crop'}
                confidence={typeof top?.confidence === 'number' ? top.confidence : undefined}
                      scanId={scanId}
      />

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
              <Text style={styles.tipsTitle}>{t('diagnose.tipsHeading')}</Text>
              <Text style={styles.tip}>{t('diagnose.tipsUseDaylight')}</Text>
              <Text style={styles.tip}>{t('diagnose.tipsFillFrame')}</Text>
              <Text style={styles.tip}>{t('diagnose.tipsAvoidShadows')}</Text>
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
  predLabel: { color: '#e5e7eb', fontSize: 14, color: '#fff', fontWeight: '600', flex: 1 },
  predPct: { color: '#ffffff', fontSize: 14, color: p.neon, fontWeight: '900' },
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