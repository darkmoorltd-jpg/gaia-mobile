import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { tap as hapticTap, success as hapticSuccess, warn as hapticWarn } from '../utils/haptics';

const PLANTNET_API_KEY = '2b10uEiVux2nL6EOw863Ot9uO';
const BASE = 'https://my-api.plantnet.org/v2';

const GAIA_CROPS = ['maize','rice','cassava','yam','tomato','pepper','cabbage','millet','sorghum','soybean','groundnut','cowpea','wheat','cocoa','oil palm'];

type Mode = 'species' | 'disease' | 'variety';

interface SpeciesResult { common: string; latin: string; confidence: number; hasDiseaseModel: boolean; }
interface DiseaseResult { eppoCode: string; name: string; confidence: number; }
interface VarietyResult { varietyName: string; species: string; confidence: number; }

const MODE_LABELS: Record<Mode, { icon: string; label: string }> = {
  species: { icon: '🌿', label: 'Species' },
  disease: { icon: '🦠', label: 'Disease' },
  variety: { icon: '🌾', label: 'Variety' },
};

export default function PlantIDCard() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('species');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [species, setSpecies] = useState<SpeciesResult[] | null>(null);
  const [diseases, setDiseases] = useState<DiseaseResult[] | null>(null);
  const [varieties, setVarieties] = useState<VarietyResult[] | null>(null);

  const resetResults = () => { setSpecies(null); setDiseases(null); setVarieties(null); };

  const pickImage = async () => {
    hapticTap();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    Alert.alert('Choose source', '', [
      { text: 'Camera', onPress: async () => {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
        if (!r.canceled) analyze(r.assets[0].uri);
      }},
      { text: 'Gallery', onPress: async () => {
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true,
        });
        if (!r.canceled) analyze(r.assets[0].uri);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ============================================================
  // Upload + call the right endpoint based on mode
  // ============================================================
  const analyze = async (uri: string) => {
    setImageUri(uri);
    resetResults();
    setBusy(true);

    const endpoint =
      mode === 'disease' ? '/diseases/identify' :
      mode === 'variety' ? '/varieties/identify' :
                           '/identify/all';

    try {
      const up = await FileSystem.uploadAsync(
        BASE + endpoint + '?api-key=' + PLANTNET_API_KEY + '&lang=en',
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'images',
          mimeType: 'image/jpeg',
          parameters: { organs: 'leaf' },
        },
      );

      if (up.status < 200 || up.status >= 300) {
        throw new Error('Pl@ntNet HTTP ' + up.status);
      }
      const data = JSON.parse(up.body || '{}');
      const results = data.results || [];

      if (results.length === 0) {
        throw new Error('No match found. Try a clearer close-up of a single leaf.');
      }

      if (mode === 'species') {
        const mapped: SpeciesResult[] = results.slice(0, 5).map((r: any) => {
          const common = r.species?.commonNames?.[0] || r.species?.scientificNameWithoutAuthor || 'Unknown';
          const latin = r.species?.scientificNameWithoutAuthor || '';
          const confidence = r.score || 0;
          const lc = common.toLowerCase();
          const hasDiseaseModel = GAIA_CROPS.some(c => lc.includes(c) || latin.toLowerCase().includes(c));
          return { common, latin, confidence, hasDiseaseModel };
        });
        setSpecies(mapped);
        if (mapped[0]?.hasDiseaseModel) hapticSuccess(); else hapticWarn();
      } else if (mode === 'disease') {
        const mapped: DiseaseResult[] = results.slice(0, 5).map((r: any) => ({
          eppoCode: r.eppoCode || r.name || r.code || '?',
          name: r.name || r.label || r.eppoCode || 'Unknown',
          confidence: r.score ?? r.probability ?? 0,
        }));
        setDiseases(mapped);
        if (mapped[0] && mapped[0].confidence > 0.5) hapticWarn(); else hapticTap();
      } else {
        // Variety: results grouped by species, varieties nested
        const flat: VarietyResult[] = [];
        results.forEach((sp: any) => {
          const speciesName =
            sp.species?.commonNames?.[0] ||
            sp.species?.scientificNameWithoutAuthor ||
            'Unknown species';
          (sp.varieties || []).forEach((v: any) => {
            flat.push({
              varietyName: v.name || v.label || '?',
              species: speciesName,
              confidence: v.score ?? v.probability ?? 0,
            });
          });
        });
        flat.sort((a, b) => b.confidence - a.confidence);
        if (flat.length === 0) throw new Error('No variety match — this crop may not be in the variety database yet.');
        setVarieties(flat.slice(0, 5));
        hapticSuccess();
      }
    } catch (e: any) {
      Alert.alert(
        mode === 'disease' ? 'Disease detection failed' :
        mode === 'variety' ? 'Variety detection failed' :
                             'Identification failed',
        e?.message || 'Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    hapticTap();
    setMode(m);
    resetResults();
  };

  // ============================================================
  // Rendering
  // ============================================================
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Plant Intelligence</Text>
        <Text style={styles.subtitle}>
          {mode === 'species'  ? 'Powered by Pl@ntNet · 60,000+ species' :
           mode === 'disease'  ? 'Detect diseases & pests (beta · limited crops)' :
                                 'Identify cultivated varieties (beta · limited crops)'}
        </Text>
      </View>

      {/* Mode picker */}
      <View style={styles.modeRow}>
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
          >
            <Text style={styles.modeIcon}>{MODE_LABELS[m].icon}</Text>
            <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>
              {MODE_LABELS[m].label}
            </Text>
          </Pressable>
        ))}
      </View>

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" /> : null}

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.busyText}>
            {mode === 'species' ? 'Identifying species…' :
             mode === 'disease' ? 'Analyzing for diseases…' :
                                  'Matching variety…'}
          </Text>
        </View>
      ) : null}

      {/* --- SPECIES RESULT --- */}
      {mode === 'species' && species && species.length > 0 ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultCommon}>{species[0].common}</Text>
          {species[0].latin ? <Text style={styles.resultLatin}>{species[0].latin}</Text> : null}
          <Text style={styles.resultConf}>{(species[0].confidence * 100).toFixed(1)}% confidence</Text>
          {species[0].hasDiseaseModel ? (
            <Pressable onPress={() => { hapticTap(); router.push('/(tabs)/crops' as any); }} style={styles.diagnoseBtn}>
              <Text style={styles.diagnoseBtnText}>DIAGNOSE DISEASES</Text>
            </Pressable>
          ) : (
            <Text style={styles.note}>Wild plant or unsupported crop.</Text>
          )}
          {species.length > 1 ? (
            <View style={styles.altsBox}>
              <Text style={styles.altsLabel}>OTHER MATCHES</Text>
              {species.slice(1).map((p, i) => (
                <Text key={i} style={styles.altRow}>• {p.common} <Text style={styles.altConf}>{(p.confidence * 100).toFixed(1)}%</Text></Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* --- DISEASE RESULT --- */}
      {mode === 'disease' && diseases && diseases.length > 0 ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultCommon}>{diseases[0].name}</Text>
          <Text style={styles.resultLatin}>EPPO: {diseases[0].eppoCode}</Text>
          <Text style={styles.resultConf}>{(diseases[0].confidence * 100).toFixed(1)}% confidence</Text>
          <Text style={styles.note}>
            ⚠️ Consult a local agronomist before applying chemical treatments.
          </Text>
          {diseases.length > 1 ? (
            <View style={styles.altsBox}>
              <Text style={styles.altsLabel}>OTHER POSSIBILITIES</Text>
              {diseases.slice(1).map((d, i) => (
                <Text key={i} style={styles.altRow}>• {d.name} <Text style={styles.altConf}>{(d.confidence * 100).toFixed(1)}%</Text></Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* --- VARIETY RESULT --- */}
      {mode === 'variety' && varieties && varieties.length > 0 ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultCommon}>{varieties[0].varietyName}</Text>
          <Text style={styles.resultLatin}>{varieties[0].species}</Text>
          <Text style={styles.resultConf}>{(varieties[0].confidence * 100).toFixed(1)}% confidence</Text>
          {varieties.length > 1 ? (
            <View style={styles.altsBox}>
              <Text style={styles.altsLabel}>OTHER VARIETIES</Text>
              {varieties.slice(1).map((v, i) => (
                <Text key={i} style={styles.altRow}>• {v.varietyName} ({v.species}) <Text style={styles.altConf}>{(v.confidence * 100).toFixed(1)}%</Text></Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Mode-specific hint */}
      {mode === 'disease' && !busy && !diseases ? (
        <Text style={styles.note}>Beta: only well-documented crop diseases are supported. Not all plants will return results.</Text>
      ) : null}
      {mode === 'variety' && !busy && !varieties ? (
        <Text style={styles.note}>Beta: only well-documented crops (tomato, citrus, cucumber, banana…) are supported.</Text>
      ) : null}

      <Pressable onPress={pickImage} disabled={busy} style={[styles.pickBtn, busy && { opacity: 0.5 }]}>
        <Text style={styles.pickBtnText}>
          {imageUri ? 'Try Another Photo' :
           mode === 'disease' ? 'Scan for Disease' :
           mode === 'variety' ? 'Scan for Variety' : 'Take Photo'}
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  card: { backgroundColor: p.surface, borderRadius: 20, padding: 20, marginVertical: 12, borderWidth: 1, borderColor: p.border },
  header: { marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '900', color: p.text },
  subtitle: { fontSize: 12, color: p.textMuted, marginTop: 4 },

  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.15)', padding: 4, borderRadius: 12 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 8 },
  modeBtnActive: { backgroundColor: 'rgba(0,255,136,0.15)' },
  modeIcon: { fontSize: 14 },
  modeLabel: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  modeLabelActive: { color: p.neon },

  thumbnail: { width: '100%', height: 180, borderRadius: 14, marginBottom: 14 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  busyText: { fontSize: 13, color: p.textMuted },
  resultBox: { backgroundColor: 'rgba(0,255,136,0.06)', borderRadius: 14, padding: 16, marginVertical: 10, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)' },
  resultCommon: { fontSize: 22, fontWeight: '900', color: p.neon },
  resultLatin: { fontSize: 13, fontStyle: 'italic', color: p.textMuted, marginTop: 4 },
  resultConf: { fontSize: 12, color: p.textMuted, marginTop: 8, marginBottom: 12 },
  diagnoseBtn: { backgroundColor: p.neon, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  diagnoseBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  note: { fontSize: 11, color: p.textMuted, fontStyle: 'italic', marginTop: 8, lineHeight: 16 },
  altsBox: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  altsLabel: { fontSize: 9, fontWeight: '900', color: p.textDim, letterSpacing: 1.5, marginBottom: 6 },
  altRow: { fontSize: 12, color: p.text, marginBottom: 4 },
  altConf: { color: p.textMuted, fontSize: 11 },
  pickBtn: { backgroundColor: p.neon, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  pickBtnText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
