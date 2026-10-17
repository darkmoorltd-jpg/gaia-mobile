import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { getSession, runModel, plantTopK, PlantPrediction } from '../utils/onDeviceModel';
import { tap as hapticTap, success as hapticSuccess, warn as hapticWarn } from '../utils/haptics';

async function imageToPlantTensor(uri: string): Promise<Float32Array | null> {
  try {
    const IM: any = await import('expo-image-manipulator');
    const r = await IM.manipulateAsync(uri, [{ resize: { width: 224, height: 224 } }],
      { compress: 1, format: IM.SaveFormat.JPEG, base64: true });
    if (!r.base64) return null;
    const { decode } = await import('jpeg-js');
    const raw: any = decode(
      Uint8Array.from(atob(r.base64), (c: string) => c.charCodeAt(0)),
      { useTArray: true },
    );
    const out = new Float32Array(3 * 224 * 224);
    for (let i = 0; i < 224 * 224; i++) {
      const rr = raw.data[i * 4] / 255;
      const g = raw.data[i * 4 + 1] / 255;
      const b = raw.data[i * 4 + 2] / 255;
      out[i]                 = (rr - 0.5) / 0.5;
      out[224 * 224 + i]     = (g - 0.5) / 0.5;
      out[2 * 224 * 224 + i] = (b - 0.5) / 0.5;
    }
    return out;
  } catch { return null; }
}

export default function PlantIDCard() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState<PlantPrediction[] | null>(null);
  const [testStatus, setTestStatus] = useState<string>('');

  const pickImage = async () => {
    hapticTap();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    Alert.alert('Choose source', '', [
      { text: 'Camera', onPress: async () => {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
        if (!r.canceled) runIdentify(r.assets[0].uri);
      }},
      { text: 'Gallery', onPress: async () => {
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true,
        });
        if (!r.canceled) runIdentify(r.assets[0].uri);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const runIdentify = async (uri: string) => {
    setImageUri(uri); setTop(null); setBusy(true);
    try {
      const sess = await getSession('plant_id');
      if (!sess) { Alert.alert('Model unavailable', 'Check internet and try again.'); setBusy(false); return; }
      const tensor = await imageToPlantTensor(uri);
      if (!tensor) { Alert.alert('Photo error', 'Try another photo.'); setBusy(false); return; }
      const out = await runModel('plant_id', tensor, 224, 224);
      if (!out) { Alert.alert('Error', 'Inference failed.'); setBusy(false); return; }
      const preds = await plantTopK(out.logits, 5);
      setTop(preds);
      if (preds[0]?.hasDiseaseModel) hapticSuccess(); else hapticWarn();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const runDownloadTest = async () => {
    setTestStatus('Starting test...');
    try {
      const { getInfoAsync, makeDirectoryAsync, downloadAsync, documentDirectory, cacheDirectory } = FileSystem;
      const baseDir = documentDirectory || cacheDirectory || '';
      const dir = baseDir + 'gaia-models/';
      const path = dir + 'plant_id.onnx';

      setTestStatus('Checking cache dir: ' + dir);
      const dirInfo = await getInfoAsync(dir).catch((e: any) => ({ exists: false, err: e.message }));
      if (!dirInfo.exists) {
        setTestStatus('Creating dir...');
        await makeDirectoryAsync(dir, { intermediates: true });
      }

      const cacheInfo = await getInfoAsync(path).catch(() => ({ exists: false }));
      setTestStatus('Cache exists: ' + cacheInfo.exists + (cacheInfo.exists ? ' (' + ((cacheInfo as any).size || 0) / 1e6 + ' MB)' : ''));

      if (!cacheInfo.exists || ((cacheInfo as any).size || 0) < 1000) {
        setTestStatus('Downloading 100 MB (may take 1-2 min)...');
        const url = 'https://github.com/darkmoorltd-jpg/gaia-mobile/releases/download/models-v2-plant/model_int8.onnx';
        const res = await downloadAsync(url, path);
        if (res.status !== 200) {
          setTestStatus('Download failed: HTTP ' + res.status);
          return;
        }
        setTestStatus('Downloaded. Creating ONNX session...');
      }

      const sess = await getSession('plant_id');
      if (!sess) {
        setTestStatus('Session creation failed — ONNX cannot load this model');
        return;
      }
      setTestStatus('✅ Model loaded! Ready to identify.');
    } catch (e: any) {
      setTestStatus('Error: ' + (e?.message || String(e)));
    }
  };

  const top1 = top?.[0];
  const conf = top1?.confidence || 0;
  const low = conf < 0.35;
  const name = top1?.common || top1?.latin || 'Unknown';
  const latin = top1?.latin && top1.latin !== name ? top1.latin : null;
  const isCrop = !!top1 && (!!top1.common || top1.hasDiseaseModel);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Identify Plant</Text>
        <Text style={styles.subtitle}>Any leaf, any species — GAIA identifies all 14,829</Text>
      </View>

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" /> : null}

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.busyText}>Analyzing leaf…</Text>
        </View>
      ) : null}

      {top && top.length > 0 ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultCommon}>{name}</Text>
          {latin ? <Text style={styles.resultLatin}>{latin}</Text> : null}
          <Text style={styles.resultConf}>
            {(conf * 100).toFixed(1)}% confidence{low ? '  (low — try clearer photo)' : ''}
          </Text>

          {top1?.hasDiseaseModel ? (
            <Pressable onPress={() => { hapticTap(); router.push('/(tabs)/crops' as any); }} style={styles.diagnoseBtn}>
              <Text style={styles.diagnoseBtnText}>DIAGNOSE DISEASES</Text>
            </Pressable>
          ) : isCrop ? (
            <Text style={styles.note}>🌱 {name} identified. GAIA doesn't diagnose its diseases yet.</Text>
          ) : (
            <Text style={styles.note}>🌿 Wild plant identified (not a GAIA-tracked crop).</Text>
          )}

          {top.length > 1 ? (
            <View style={styles.altsBox}>
              <Text style={styles.altsLabel}>OTHER MATCHES</Text>
              {top.slice(1).map((p, i) => (
                <Text key={i} style={styles.altRow}>
                  • {p.common || p.latin} <Text style={styles.altConf}>{(p.confidence * 100).toFixed(1)}%</Text>
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {testStatus ? (
        <View style={{ marginTop: 10, padding: 12, backgroundColor: 'rgba(0,255,136,0.1)', borderRadius: 10 }}>
          <Text style={{ fontSize: 11, color: palette.text, fontFamily: 'monospace' }}>{testStatus}</Text>
        </View>
      ) : null}

      <Pressable onPress={runDownloadTest} disabled={busy} style={[styles.pickBtn, { marginTop: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.neon }]}>
        <Text style={[styles.pickBtnText, { color: palette.neon }]}>TEST MODEL DOWNLOAD</Text>
      </Pressable>

      <Pressable onPress={pickImage} disabled={busy} style={[styles.pickBtn, busy && { opacity: 0.5 }]}>
        <Text style={styles.pickBtnText}>{imageUri ? 'Try Another Photo' : 'Take Photo'}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  card: { backgroundColor: p.surface, borderRadius: 20, padding: 20, marginVertical: 12, borderWidth: 1, borderColor: p.border },
  header: { marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '900', color: p.text },
  subtitle: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  thumbnail: { width: '100%', height: 180, borderRadius: 14, marginBottom: 14 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  busyText: { fontSize: 13, color: p.textMuted },
  resultBox: { backgroundColor: 'rgba(0,255,136,0.06)', borderRadius: 14, padding: 16, marginVertical: 10, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)' },
  resultCommon: { fontSize: 22, fontWeight: '900', color: p.neon },
  resultLatin: { fontSize: 13, fontStyle: 'italic', color: p.textMuted, marginTop: 4 },
  resultConf: { fontSize: 12, color: p.textMuted, marginTop: 8, marginBottom: 12 },
  diagnoseBtn: { backgroundColor: p.neon, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  diagnoseBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  note: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', marginTop: 4 },
  altsBox: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  altsLabel: { fontSize: 9, fontWeight: '900', color: p.textDim, letterSpacing: 1.5, marginBottom: 6 },
  altRow: { fontSize: 12, color: p.text, marginBottom: 4 },
  altConf: { color: p.textMuted, fontSize: 11 },
  pickBtn: { backgroundColor: p.neon, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  pickBtnText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
