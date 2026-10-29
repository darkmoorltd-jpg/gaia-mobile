import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { tap as hapticTap, success as hapticSuccess, warn as hapticWarn } from '../utils/haptics';

const PLANTNET_API_KEY = '2b10uEiVux2nL6EOw863Ot9uO';
const API_URL = 'https://my-api.plantnet.org/v2/identify/all';

// Crops GAIA currently diagnoses
const GAIA_CROPS = ['maize', 'rice', 'cassava', 'yam', 'tomato', 'pepper', 'cabbage', 'millet', 'sorghum', 'soybean', 'groundnut', 'cowpea', 'wheat', 'cocoa', 'oil palm'];

interface PlantResult {
  common: string;
  latin: string;
  confidence: number;
  hasDiseaseModel: boolean;
}

export default function PlantIDCard() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PlantResult[] | null>(null);

  const pickImage = async () => {
    hapticTap();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    Alert.alert('Choose source', '', [
      { text: 'Camera', onPress: async () => {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
        if (!r.canceled) identifyPlant(r.assets[0].uri);
      }},
      { text: 'Gallery', onPress: async () => {
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true,
        });
        if (!r.canceled) identifyPlant(r.assets[0].uri);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const identifyPlant = async (uri: string) => {
    setImageUri(uri); 
    setResults(null); 
    setBusy(true);
    
    try {
      const uploadResult = await FileSystem.uploadAsync(
        API_URL + '?api-key=' + PLANTNET_API_KEY,
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'images',
          mimeType: 'image/jpeg',
          parameters: { organs: 'leaf' },
        }
      );

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Pl@ntNet error: HTTP ${uploadResult.status}`);
      }

      const data = JSON.parse(uploadResult.body);
      if (!data.results || data.results.length === 0) {
        throw new Error('No plant matches found. Try a clearer photo of a single leaf.');
      }

      const top: PlantResult[] = data.results.slice(0, 5).map((r: any) => {
        const common = r.species.commonNames?.[0] || r.species.scientificNameWithoutAuthor || 'Unknown';
        const latin = r.species.scientificNameWithoutAuthor || '';
        const confidence = r.score;
        const lowerCommon = common.toLowerCase();
        const hasDiseaseModel = GAIA_CROPS.some(c => lowerCommon.includes(c) || latin.toLowerCase().includes(c));
        return { common, latin, confidence, hasDiseaseModel };
      });

      setResults(top);
      if (top[0]?.hasDiseaseModel) hapticSuccess(); else hapticWarn();

    } catch (e: any) {
      Alert.alert('Identification failed', e.message || 'Check internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const top1 = results?.[0];
  const conf = top1 ? top1.confidence * 100 : 0;
  const low = conf < 35;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Plant ID</Text>
        <Text style={styles.subtitle}>Powered by DARKMOOR LTD 🌱</Text>
      </View>

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" /> : null}

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.busyText}>Identifying species…</Text>
        </View>
      ) : null}

      {results && results.length > 0 ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultCommon}>{top1?.common}</Text>
          {top1?.latin ? <Text style={styles.resultLatin}>{top1?.latin}</Text> : null}
          <Text style={styles.resultConf}>
            {conf.toFixed(1)}% confidence{low ? ' (low — try clearer photo)' : ''}
          </Text>

          {top1?.hasDiseaseModel ? (
            <Pressable onPress={() => { hapticTap(); router.push('/(tabs)/crops' as any); }} style={styles.diagnoseBtn}>
              <Text style={styles.diagnoseBtnText}>DIAGNOSE DISEASES</Text>
            </Pressable>
          ) : (
            <Text style={styles.note}>
              {top1?.hasDiseaseModel 
                ? '🌱 GAIA diagnoses this crop.' 
                : '🌿 Wild plant or unsupported crop.'}
            </Text>
          )}

          {results.length > 1 ? (
            <View style={styles.altsBox}>
              <Text style={styles.altsLabel}>OTHER MATCHES</Text>
              {results.slice(1).map((p, i) => (
                <Text key={i} style={styles.altRow}>
                  • {p.common} <Text style={styles.altConf}>{(p.confidence * 100).toFixed(1)}%</Text>
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

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
  subtitle: { fontSize: 12, color: p.neon, marginTop: 4, fontWeight: '700', letterSpacing: 0.5 },
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
