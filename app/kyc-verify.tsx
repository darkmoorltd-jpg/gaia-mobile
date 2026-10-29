import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { verifyBVN, verifyNIN, verifyDocumentAndFace, KYCResult } from '../src/utils/dojah';
import { tap as hapticTap, success as hapticSuccess } from '../src/utils/haptics';

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', types: ['BVN', 'NIN', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD'] },
  { code: 'GH', name: 'Ghana', types: ['PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD'] },
  { code: 'KE', name: 'Kenya', types: ['PASSPORT', 'DRIVERS_LICENSE'] },
  { code: 'ZA', name: 'South Africa', types: ['PASSPORT', 'DRIVERS_LICENSE'] },
  { code: 'GLOBAL', name: 'Other Country', types: ['PASSPORT'] },
];

export default function KYCVerifyScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [mode, setMode] = useState<'bvn' | 'nin' | 'document'>('bvn');
  const [idNumber, setIdNumber] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [docType, setDocType] = useState(COUNTRIES[0].types[2]);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KYCResult | null>(null);

  const pickImage = async (setter: (v: string) => void) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const handleVerify = async () => {
    hapticTap();
    setBusy(true);
    setResult(null);

    try {
      let res: KYCResult;

      if (mode === 'bvn' || mode === 'nin') {
        if (idNumber.length !== 11) { Alert.alert('Invalid', '11 digits required'); setBusy(false); return; }
        res = mode === 'bvn' ? await verifyBVN(idNumber) : await verifyNIN(idNumber);
      } else {
        if (!idImage || !selfieImage) { Alert.alert('Missing', 'Both ID and Selfie required'); setBusy(false); return; }
        res = await verifyDocumentAndFace(idImage, selfieImage, docType, country.code);
      }

      setResult(res);

      if (res.success) {
        hapticSuccess();
        if (user) {
          await supabase.from('user_profiles').update({
            verification_status: 'approved',
            kyc_level: 2,
            updated_at: new Date().toISOString()
          }).eq('user_id', user.id);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>🛡️ Identity Verification</Text>
        
        {/* Mode Toggle */}
        <View style={styles.tabRow}>
          <Pressable onPress={() => { setMode('bvn'); setResult(null); }} style={[styles.tabBtn, mode === 'bvn' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, mode === 'bvn' && styles.tabTextActive]}>BVN</Text>
          </Pressable>
          <Pressable onPress={() => { setMode('nin'); setResult(null); }} style={[styles.tabBtn, mode === 'nin' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, mode === 'nin' && styles.tabTextActive]}>NIN</Text>
          </Pressable>
          <Pressable onPress={() => { setMode('document'); setResult(null); }} style={[styles.tabBtn, mode === 'document' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, mode === 'document' && styles.tabTextActive]}>ID Document</Text>
          </Pressable>
        </View>

        {/* BVN / NIN INPUT */}
        {(mode === 'bvn' || mode === 'nin') && (
          <>
            <Text style={styles.label}>{mode.toUpperCase()} (11 DIGITS)</Text>
            <TextInput
              value={idNumber}
              onChangeText={setIdNumber}
              keyboardType="number-pad"
              maxLength={11}
              placeholder="e.g. 22222222222"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />
          </>
        )}

        {/* DOCUMENT INPUT */}
        {mode === 'document' && (
          <>
            <Text style={styles.label}>COUNTRY</Text>
            <View style={styles.pickerWrap}>
              {COUNTRIES.map(c => (
                <Pressable key={c.code} onPress={() => { setCountry(c); setDocType(c.types[0]); }} style={[styles.pill, country.code === c.code && styles.pillActive]}>
                  <Text style={[styles.pillText, country.code === c.code && styles.pillTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>DOCUMENT TYPE</Text>
            <View style={styles.pickerWrap}>
              {country.types.filter(t => t !== 'BVN' && t !== 'NIN').map(t => (
                <Pressable key={t} onPress={() => setDocType(t)} style={[styles.pill, docType === t && styles.pillActive]}>
                  <Text style={[styles.pillText, docType === t && styles.pillTextActive]}>{t.replace('_', ' ')}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.imageRow}>
              <Pressable onPress={() => pickImage(setIdImage)} style={styles.imageBox}>
                {idImage ? <Image source={{ uri: idImage }} style={styles.img} /> : <Text style={styles.imgTxt}>+ ID Photo</Text>}
              </Pressable>
              <Pressable onPress={() => pickImage(setSelfieImage)} style={styles.imageBox}>
                {selfieImage ? <Image source={{ uri: selfieImage }} style={styles.img} /> : <Text style={styles.imgTxt}>+ Selfie</Text>}
              </Pressable>
            </View>
          </>
        )}

        <Pressable onPress={handleVerify} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>VERIFY</Text>}
        </Pressable>

        {result && (
          <View style={[styles.resultBox, { borderColor: result.success ? '#00ff88' : '#ff3b5c' }]}>
            <Text style={[styles.resultTitle, { color: result.success ? '#00ff88' : '#ff3b5c' }]}>
              {result.success ? '✅ Verified' : '❌ Failed'}
            </Text>
            <Text style={styles.resultMsg}>{result.message}</Text>
            {result.success && result.data && (
              <View style={styles.dataBox}>
                {result.data.firstName && <Text style={styles.dataRow}><Text style={styles.dataLabel}>Name:</Text> {result.data.firstName} {result.data.lastName}</Text>}
                {result.data.faceMatchScore && <Text style={styles.dataRow}><Text style={styles.dataLabel}>Face Match:</Text> {result.data.faceMatchScore}%</Text>}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 20 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.15)' },
  tabText: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  tabTextActive: { color: p.neon },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6, marginTop: 12 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 16, letterSpacing: 2, marginBottom: 20 },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  pillActive: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.1)' },
  pillText: { fontSize: 11, color: p.textMuted, fontWeight: '700' },
  pillTextActive: { color: p.neon },
  imageRow: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 24 },
  imageBox: { flex: 1, height: 120, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, overflow: 'hidden' },
  imgTxt: { fontSize: 12, color: p.textMuted, fontWeight: '700' },
  img: { width: '100%', height: '100%', resizeMode: 'cover' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  resultBox: { marginTop: 24, padding: 20, borderRadius: 16, borderWidth: 2, backgroundColor: p.surface },
  resultTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  resultMsg: { fontSize: 13, color: p.textMuted, marginBottom: 16 },
  dataBox: { gap: 8 },
  dataRow: { fontSize: 14, color: p.text },
  dataLabel: { fontWeight: '800', color: p.neon },
});
