import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { getSession, runModel, softmax } from '../utils/onDeviceModel';
import { NIGERIAN_CROPS, cropByModelIdx } from '../utils/onDeviceModel';
import * as FileSystem from 'expo-file-system/legacy';
import { tap as hapticTap, success as hapticSuccess, warn as hapticWarn } from '../utils/haptics';

const PLANT_KEYS: Record<string, string> = {}; // no-op placeholder

// Plant ID uses mean=0.5 / std=0.5 normalization (per preprocess.json),
// unlike the ImageNet normalization used by pests/soil/poultry.
async function imageToPlantTensor(uri: string): Promise<Float32Array | null> {
  try {
    const ImageManipulator: any = await import('expo-image-manipulator');
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 224, height: 224 } }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!resized.base64) return null;
    const { decode } = await import('jpeg-js');
    const raw: any = decode(
      Uint8Array.from(atob(resized.base64), (c: string) => c.charCodeAt(0)),
      { useTArray: true },
    );
    const out = new Float32Array(3 * 224 * 224);
    for (let i = 0; i < 224 * 224; i++) {
      const r = raw.data[i * 4] / 255;
      const g = raw.data[i * 4 + 1] / 255;
      const b = raw.data[i * 4 + 2] / 255;
      out[i]                 = (r - 0.5) / 0.5;
      out[224 * 224 + i]     = (g - 0.5) / 0.5;
      out[2 * 224 * 224 + i] = (b - 0.5) / 0.5;
    }
    return out;
  } catch (e) {
    console.warn('[plant] tensor build failed', e);
    return null;
  }
}

interface Props {
  onCropIdentified?: (cropKey: string) => void;
}

export default function PlantIDCard({ onCropIdentified }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dlPct, setDlPct] = useState<number | null>(null);
  const [result, setResult] = useState<{
    common: string;
    latin: string;
    cropKey: string | null;
    confidence: number;
  } | null>(null);

  const pickImage = async () => {
    hapticTap();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required');
      return;
    }
    Alert.alert('Choose source', '', [
      {
        text: 'Camera',
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
          if (!r.canceled) runIdentify(r.assets[0].uri);
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
          });
          if (!r.canceled) runIdentify(r.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const runIdentify = async (uri: string) => {
    setImageUri(uri);
    setResult(null);
    setBusy(true);
    setDlPct(null);

    try {
      // 1. Ensure model is downloaded (may take a while first time)
      const isCached = await FileSystem.getInfoAsync(
        (FileSystem.documentDirectory || '') + 'gaia-models/plant_id.onnx',
      );
      if (!isCached.exists) {
        setDlPct(0);
      }

      const sess = await getSession('plant_id');
      setDlPct(null);
      if (!sess) {
        Alert.alert('Model unavailable', 'Could not download the plant ID model. Check your internet and try again.');
        setBusy(false);
        return;
      }

      // 2. Build tensor with 0.5/0.5 normalization
      const tensor = await imageToPlantTensor(uri);
      if (!tensor) {
        Alert.alert('Photo error', 'Could not process that photo. Try another.');
        setBusy(false);
        return;
      }

      // 3. Run inference
      const out = await runModel('plant_id', tensor, 224, 224);
      if (!out) {
        Alert.alert('Model error', 'Inference failed.');
        setBusy(false);
        return;
      }

      const probs = softmax(out.logits);
      const topIdx = probs.indexOf(Math.max(...probs));
      const confidence = probs[topIdx];

      // 4. Look up whether top class is a Nigerian crop
      const cropMatch = cropByModelIdx(topIdx);

      if (cropMatch) {
        setResult({
          common: cropMatch.common,
          latin: cropMatch.latin,
          cropKey: cropMatch.key,
          confidence,
        });
        hapticSuccess();
      } else {
        // Not in our Nigerian map — give best guess with a warning
        setResult({
          common: 'Unknown plant',
          latin: `Not recognized as a Nigerian crop`,
          cropKey: null,
          confidence,
        });
        hapticWarn();
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleDiagnose = () => {
    if (!result?.cropKey) {
      Alert.alert(
        'Select crop manually',
        'GAIA does not have a disease model for this plant yet. Tap Crops to pick manually.',
      );
      return;
    }
    hapticTap();
    if (onCropIdentified) onCropIdentified(result.cropKey);
    router.push('/(tabs)/crops' as any);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Identify Plant</Text>
        <Text style={styles.subtitle}>Snap a leaf — GAIA tells you what crop it is</Text>
      </View>

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
      ) : null}

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.busyText}>
            {dlPct !== null ? 'Downloading plant model…' : 'Analyzing leaf…'}
          </Text>
        </View>
      ) : null}

      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultCommon}>{result.common}</Text>
          {result.latin ? <Text style={styles.resultLatin}>{result.latin}</Text> : null}
          <Text style={styles.resultConf}>{(result.confidence * 100).toFixed(1)}% confidence</Text>
          {result.cropKey ? (
            <Pressable onPress={handleDiagnose} style={styles.diagnoseBtn}>
              <Text style={styles.diagnoseBtnText}>DIAGNOSE NOW</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)/crops' as any)}
              style={[styles.diagnoseBtn, { backgroundColor: palette.surface }]}
            >
              <Text style={[styles.diagnoseBtnText, { color: palette.text }]}>PICK CROP MANUALLY</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <Pressable onPress={pickImage} disabled={busy} style={[styles.pickBtn, busy && { opacity: 0.5 }]}>
        <Text style={styles.pickBtnText}>
          {imageUri ? 'Try Another Photo' : 'Take Photo'}
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  card: {
    backgroundColor: p.surface,
    borderRadius: 20,
    padding: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: p.border,
  },
  header: { marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '900', color: p.text },
  subtitle: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  thumbnail: { width: '100%', height: 180, borderRadius: 14, marginBottom: 14 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  busyText: { fontSize: 13, color: p.textMuted },
  resultBox: {
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.25)',
  },
  resultCommon: { fontSize: 22, fontWeight: '900', color: p.neon },
  resultLatin: { fontSize: 13, fontStyle: 'italic', color: p.textMuted, marginTop: 4 },
  resultConf: { fontSize: 12, color: p.textMuted, marginTop: 8, marginBottom: 12 },
  diagnoseBtn: {
    backgroundColor: p.neon,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  diagnoseBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  pickBtn: {
    backgroundColor: p.neon,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  pickBtnText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
