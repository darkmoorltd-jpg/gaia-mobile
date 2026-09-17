
import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image, Modal, FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, GlassCard, NeonButton, Pill } from '../components';
import { palette, typography, spacing, radius, shadows } from '../theme';
import { useAuth } from '../store/auth';
import { supabase } from '../api/supabase';
import { diagnose } from '../api/models';

export interface DiagnoseConfig {
  key: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  modelKey: string;
  options: { key: string; label: string; emoji: string }[];
  contextType: 'crop' | 'pest' | 'soil' | 'livestock';
}

export function DiagnoseScreen({ config }: { config: DiagnoseConfig }) {
  const { user, scansRemaining, refreshScans } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [selected, setSelected] = useState(config.options[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const cameraRef = useRef<CameraView>(null);

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        setError('Camera permission required.');
        return;
      }
    }
    setImageUri(null);
    setResult(null);
    setError('');
  };

  const shoot = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setImageUri(photo.uri);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Capture failed');
    }
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const analyze = async () => {
    if (!imageUri || !user) return;
    if (scansRemaining <= 0) {
      setError('No scans left. Buy more to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await diagnose(imageUri, config.modelKey, token);
      setResult(res);
      await refreshScans();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message ?? 'Diagnosis failed.');
    } finally {
      setLoading(false);
    }
  };

  // --------- RESULT VIEW ---------
  if (result) {
    const top = result.top;
    const healthy = top.label.toLowerCase().includes('healthy');
    const accent = healthy ? palette.neon : palette.warning;

    return (
      <Screen glow="crops">
        <ScrollView contentContainerStyle={styles.scroll}>
          <Animated.View entering={FadeInDown.duration(600)}>
            <LinearGradient
              colors={[accent, accent + '99']}
              style={styles.resultHero}
            >
              <Text style={styles.resultEmoji}>{healthy ? '✓' : '⚠'}</Text>
              <Text style={styles.resultLabel}>{top.label}</Text>
              <Text style={styles.resultConfidence}>
                {top.confidence.toFixed(1)}% CONFIDENCE
              </Text>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.sectionLabel}>ALL PREDICTIONS</Text>
          {result.predictions.map((p: any, i: number) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(i * 80).duration(500)}
              style={{ marginBottom: spacing.md }}
            >
              <GlassCard>
                <View style={styles.predRow}>
                  <Text style={styles.predLabel}>{p.label}</Text>
                  <Text style={styles.predPct}>{p.confidence.toFixed(1)}%</Text>
                </View>
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(p.confidence, 100)}%`, backgroundColor: palette.neon },
                    ]}
                  />
                </View>
              </GlassCard>
            </Animated.View>
          ))}

          <Text style={styles.sectionLabel}>RECOMMENDED ACTIONS</Text>
          <GlassCard>
            <Text style={styles.actionTitle}>🌿 Organic</Text>
            <Text style={styles.actionBody}>Apply neem oil spray at 5ml/L every 7 days.</Text>
            <View style={styles.actionDivider} />
            <Text style={styles.actionTitle}>🧪 Chemical</Text>
            <Text style={styles.actionBody}>Mancozeb 80% WP at 2g/L. Spray evening, not midday.</Text>
            <View style={styles.actionDivider} />
            <Text style={styles.actionTitle}>💧 Water</Text>
            <Text style={styles.actionBody}>Avoid overhead irrigation to reduce leaf wetness.</Text>
          </GlassCard>

          <View style={{ height: spacing.xl }} />
          <NeonButton label="NEW SCAN" onPress={() => setResult(null)} />
          <View style={{ height: spacing.md }} />
          <NeonButton label="SAVE TO HISTORY" variant="ghost" onPress={() => setResult(null)} />
          <View style={{ height: 120 }} />
        </ScrollView>
      </Screen>
    );
  }

  // --------- CAMERA VIEW ---------
  return (
    <Screen glow={config.contextType as any}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Pill label={config.title.toUpperCase()} color={config.color} />
          <Text style={styles.title}>{config.emoji}  {config.title}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100)} style={styles.scanBar}>
          <Text style={styles.scanText}>📉 {scansRemaining} SCANS LEFT</Text>
        </Animated.View>

        {/* Selector */}
        <Pressable
          onPress={() => setShowPicker(true)}
          style={styles.selector}
        >
          <Text style={styles.selectorEmoji}>{selected.emoji}</Text>
          <Text style={styles.selectorLabel}>{selected.label}</Text>
          <Text style={styles.selectorCaret}>▼</Text>
        </Pressable>

        {/* Preview */}
        {imageUri ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.previewBox}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
          </Animated.View>
        ) : permission?.granted ? (
          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.frameOverlay} />
            <Pressable onPress={shoot} style={styles.shutter}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={openCamera} style={styles.cameraBox}>
            <View style={styles.cameraPlaceholder}>
              <Text style={{ fontSize: 48 }}>📷</Text>
              <Text style={styles.cameraHint}>TAP TO OPEN CAMERA</Text>
            </View>
          </Pressable>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <Pressable onPress={pickFromGallery} style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>🖼</Text>
            <Text style={styles.actionBtnLabel}>ALBUM</Text>
          </Pressable>
          <Pressable onPress={openCamera} style={styles.actionBtn}>
            <Text style={styles.actionBtnIcon}>📸</Text>
            <Text style={styles.actionBtnLabel}>CAMERA</Text>
          </Pressable>
          <Pressable
            onPress={() => { setImageUri(null); setResult(null); }}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnIcon}>↺</Text>
            <Text style={styles.actionBtnLabel}>RESET</Text>
          </Pressable>
        </View>

        {imageUri && (
          <Animated.View entering={FadeInUp.duration(400)} style={{ marginTop: spacing.lg }}>
            <NeonButton
              label={loading ? '' : `ANALYZE WITH AI`}
              onPress={analyze}
              loading={loading}
              disabled={!imageUri || loading}
            />
          </Animated.View>
        )}

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
            <Text style={styles.modalTitle}>SELECT {config.title.toUpperCase()}</Text>
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
                  <Text style={styles.modalEmoji}>{item.emoji}</Text>
                  <Text style={styles.modalLabel}>{item.label}</Text>
                  {selected.key === item.key && (
                    <Text style={styles.modalCheck}>✓</Text>
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.md },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  scanBar: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.neonSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  scanText: { ...typography.micro, color: palette.neon, textAlign: 'center' },
  selector: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: palette.surface, borderWidth: 1,
    borderColor: palette.border, marginTop: spacing.md,
  },
  selectorEmoji: { fontSize: 22 },
  selectorLabel: { ...typography.body, color: palette.text, fontWeight: '700', flex: 1 },
  selectorCaret: { color: palette.textMuted, fontSize: 12 },
  cameraBox: {
    marginTop: spacing.lg, aspectRatio: 1, borderRadius: radius.xl,
    overflow: 'hidden', backgroundColor: palette.abyss,
    borderWidth: 1, borderColor: palette.border, position: 'relative',
  },
  camera: { flex: 1 },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cameraHint: { ...typography.micro, color: palette.textMuted },
  frameOverlay: {
    position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%',
    borderWidth: 2, borderColor: palette.neon, borderRadius: radius.lg, opacity: 0.6,
  },
  shutter: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 3, borderColor: palette.neon,
    alignItems: 'center', justifyContent: 'center',
    left: '50%', marginLeft: -36,
  },
  shutterInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: palette.neon,
    ...shadows.neon,
  },
  previewBox: {
    marginTop: spacing.lg, aspectRatio: 1, borderRadius: radius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: palette.borderHi,
    ...shadows.neon,
  },
  preview: { flex: 1, resizeMode: 'cover' },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  actionBtn: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: palette.surface, borderWidth: 1,
    borderColor: palette.border, alignItems: 'center',
  },
  actionBtnIcon: { fontSize: 22 },
  actionBtnLabel: { ...typography.micro, color: palette.text, marginTop: 6 },
  error: { color: palette.danger, textAlign: 'center', marginTop: spacing.md, fontSize: 13 },
  // Result
  resultHero: {
    borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center',
    marginBottom: spacing.xl,
  },
  resultEmoji: { fontSize: 64, color: '#000', fontWeight: '900' },
  resultLabel: { fontSize: 26, fontWeight: '900', color: '#000', marginTop: spacing.md, textAlign: 'center' },
  resultConfidence: { ...typography.micro, color: '#000', marginTop: spacing.sm },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginVertical: spacing.lg },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  predLabel: { ...typography.body, color: palette.text, fontWeight: '600', flex: 1 },
  predPct: { color: palette.neon, fontWeight: '800' },
  barBg: { height: 6, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  actionTitle: { ...typography.body, color: palette.neon, fontWeight: '800', marginTop: spacing.sm },
  actionBody: { ...typography.body, color: palette.textMuted, marginTop: 4, lineHeight: 20 },
  actionDivider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.md },
  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: palette.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.xl, maxHeight: '75%', borderTopWidth: 1, borderColor: palette.borderHi,
  },
  modalTitle: { ...typography.micro, color: palette.textMuted, marginBottom: spacing.lg },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm,
    backgroundColor: palette.surface,
  },
  modalItemActive: { backgroundColor: palette.neonSoft, borderWidth: 1, borderColor: palette.borderHi },
  modalEmoji: { fontSize: 22 },
  modalLabel: { ...typography.body, color: palette.text, flex: 1, fontWeight: '600' },
  modalCheck: { color: palette.neon, fontSize: 18, fontWeight: '900' },
});
