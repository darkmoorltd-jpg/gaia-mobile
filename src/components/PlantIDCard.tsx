import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator, Animated } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { tap as hapticTap, success as hapticSuccess, warn as hapticWarn } from '../utils/haptics';

const PLANTNET_KEYS = [
  '2b10uEiVux2nL6EOw863Ot9uO',
  '2b100GopxEAOR8NfYlKcGE2qYO',
  '2b10ouIpoVFQ1yciN9SADrN5e',
  '2b10W7qi9yUJ5VZpuzw0mD5rie',
  '2b10bRL4XK2I9Hp9immlNr8U8',
];

const API_URL = 'https://my-api.plantnet.org/v2/identify/all';
const GAIA_CROPS = ['maize', 'rice', 'cassava', 'yam', 'tomato', 'pepper', 'cabbage', 'millet', 'sorghum', 'soybean', 'groundnut', 'cowpea', 'wheat', 'cocoa', 'oil palm'];
const HISTORY_KEY = '@gaia_plant_history';

interface PlantResult {
  common: string;
  latin: string;
  confidence: number;
  hasDiseaseModel: boolean;
  timestamp?: number;
}

export default function PlantIDCard() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PlantResult[] | null>(null);
  const [history, setHistory] = useState<PlantResult[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  };

  const saveToHistory = async (plant: PlantResult) => {
    try {
      const newEntry = { ...plant, timestamp: Date.now() };
      const newHist = [newEntry, ...history.filter(h => h.common !== plant.common)].slice(0, 5);
      setHistory(newHist);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHist));
    } catch {}
  };

  const clearHistory = async () => {
    await AsyncStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

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
    
    let success = false;
    let jsonData: any = null;
    let lastError: any = null;

    for (let i = 0; i < PLANTNET_KEYS.length; i++) {
      try {
        const uploadResult = await FileSystem.uploadAsync(
          API_URL + '?api-key=' + PLANTNET_KEYS[i],
          uri,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'images',
            mimeType: 'image/jpeg',
            parameters: { organs: 'leaf' },
          }
        );

        if (uploadResult.status === 429) {
          console.log('[PlantID] Key ' + (i + 1) + ' limit reached. Rotating...');
          continue; 
        }

        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error('Pl@ntNet HTTP ' + uploadResult.status);
        }

        jsonData = JSON.parse(uploadResult.body);
        success = true;
        break;
      } catch (e: any) {
        lastError = e;
        if (!e.message.includes('HTTP')) break; 
      }
    }

    if (!success) {
      Alert.alert('Identification failed', lastError?.message || 'All daily limits reached.');
      setBusy(false);
      return;
    }

    try {
      if (!jsonData.results || jsonData.results.length === 0) {
        throw new Error('No plant matches found. Try a clearer photo.');
      }

      const top: PlantResult[] = jsonData.results.slice(0, 5).map((r: any) => {
        const common = r.species.commonNames?.[0] || r.species.scientificNameWithoutAuthor || 'Unknown';
        const latin = r.species.scientificNameWithoutAuthor || '';
        const confidence = r.score;
        const lowerCommon = common.toLowerCase();
        const hasDiseaseModel = GAIA_CROPS.some(c => lowerCommon.includes(c) || latin.toLowerCase().includes(c));
        return { common, latin, confidence, hasDiseaseModel };
      });

      setResults(top);
      saveToHistory(top[0]);
      if (top[0]?.hasDiseaseModel) hapticSuccess(); else hapticWarn();

    } catch (e: any) {
      Alert.alert('Identification failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const top1 = results?.[0];
  const conf = top1 ? top1.confidence * 100 : 0;
  const low = conf < 35;

  return (
    <View style={styles.card}>
      <LinearGradient colors={['rgba(0,255,136,0.1)', 'transparent']} style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>🌱 Plant ID</Text>
            <Text style={styles.subtitle}>Powered by DARKMOOR AI</Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>60K+ Species</Text></View>
        </View>
      </LinearGradient>

      {imageUri ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.imageOverlay} />
        </View>
      ) : (
        <Animated.View style={[styles.scannerPlaceholder, { transform: [{ scale: pulseAnim }] }]}>
          <Pressable onPress={pickImage} style={styles.scanBtnInner}>
            <Text style={styles.scanIcon}>📸</Text>
            <Text style={styles.scanText}>Tap to Scan</Text>
          </Pressable>
        </Animated.View>
      )}

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.busyText}>GAIA is identifying...</Text>
        </View>
      ) : null}

      {results && results.length > 0 ? (
        <View style={styles.resultBox}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultCommon}>{top1?.common}</Text>
            <Text style={styles.resultConf}>{conf.toFixed(1)}% match</Text>
          </View>
          <Text style={styles.resultLatin}>{top1?.latin}</Text>

          {top1?.hasDiseaseModel ? (
            <Pressable onPress={() => { hapticTap(); router.push('/(tabs)/crops' as any); }} style={styles.diagnoseBtn}>
              <Text style={styles.diagnoseBtnText}>🩺 DIAGNOSE CROP DISEASES</Text>
            </Pressable>
          ) : null}

          {results.length > 1 ? (
            <View style={styles.altsBox}>
              <Text style={styles.altsLabel}>OTHER MATCHES</Text>
              {results.slice(1).map((p, i) => (
                <View key={i} style={styles.altRow}>
                  <Text style={styles.altName}>• {p.common}</Text>
                  <Text style={styles.altConf}>{(p.confidence * 100).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {imageUri ? (
         <Pressable onPress={pickImage} disabled={busy} style={[styles.pickBtn, busy && { opacity: 0.5 }]}>
           <Text style={styles.pickBtnText}>Scan Another Plant</Text>
         </Pressable>
      ) : null}

      {history.length > 0 ? (
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent Scans</Text>
            <Pressable onPress={clearHistory}><Text style={styles.clearText}>Clear</Text></Pressable>
          </View>
          {history.map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <Text style={styles.historyName}>🌿 {h.common}</Text>
              <Text style={styles.historyConf}>{(h.confidence * 100).toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  card: { backgroundColor: p.surface, borderRadius: 24, marginVertical: 12, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)', overflow: 'hidden', shadowColor: '#00ff88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  
  headerGradient: { padding: 20, paddingBottom: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 10, fontWeight: '800', color: p.neon, marginTop: 4, letterSpacing: 1.5, textTransform: 'uppercase' },
  badge: { backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  badgeText: { fontSize: 10, fontWeight: '800', color: p.neon },

  scannerPlaceholder: { height: 140, marginHorizontal: 20, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(0,255,136,0.3)', borderStyle: 'dashed', backgroundColor: 'rgba(0,255,136,0.03)', alignItems: 'center', justifyContent: 'center' },
  scanBtnInner: { alignItems: 'center' },
  scanIcon: { fontSize: 32, marginBottom: 8 },
  scanText: { fontSize: 13, fontWeight: '800', color: p.neon, letterSpacing: 1 },

  imageContainer: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  thumbnail: { width: '100%', height: 180 },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },

  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 16 },
  busyText: { fontSize: 13, color: p.textMuted, fontWeight: '600' },

  resultBox: { marginHorizontal: 20, marginTop: 16, backgroundColor: 'rgba(0,255,136,0.06)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultCommon: { fontSize: 22, fontWeight: '900', color: p.text, flex: 1 },
  resultConf: { fontSize: 12, fontWeight: '900', color: p.obsidian, backgroundColor: p.neon, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  resultLatin: { fontSize: 13, fontStyle: 'italic', color: p.textMuted, marginTop: 4 },
  
  diagnoseBtn: { backgroundColor: p.neon, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  diagnoseBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  
  altsBox: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  altsLabel: { fontSize: 9, fontWeight: '900', color: p.textDim, letterSpacing: 1.5, marginBottom: 8 },
  altRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  altName: { fontSize: 13, color: p.text },
  altConf: { fontSize: 12, fontWeight: '700', color: p.textMuted },

  pickBtn: { marginHorizontal: 20, marginTop: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.neon, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pickBtnText: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1 },

  historyContainer: { marginHorizontal: 20, marginTop: 20, marginBottom: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historyTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted, textTransform: 'uppercase' },
  clearText: { fontSize: 11, color: p.danger, fontWeight: '700' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  historyName: { fontSize: 13, color: p.text, fontWeight: '600' },
  historyConf: { fontSize: 12, color: p.neon, fontWeight: '800' },
});
