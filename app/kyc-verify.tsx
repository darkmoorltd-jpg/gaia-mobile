import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { verifyBVN, verifyNIN, KYCResult } from '../src/utils/dojah';
import { tap as hapticTap, success as hapticSuccess } from '../src/utils/haptics';

export default function KYCVerifyScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [mode, setMode] = useState<'bvn' | 'nin'>('bvn');
  const [idNumber, setIdNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KYCResult | null>(null);

  const handleVerify = async () => {
    if (idNumber.length !== 11) {
      Alert.alert('Invalid Input', 'Must be exactly 11 digits.');
      return;
    }

    hapticTap();
    setBusy(true);
    setResult(null);

    try {
      const res = mode === 'bvn' ? await verifyBVN(idNumber) : await verifyNIN(idNumber);
      setResult(res);

      if (res.success) {
        hapticSuccess();
        // Save to Supabase (marking KYC as verified)
        if (user) {
          await supabase.from('user_profiles').update({
            [mode]: idNumber,
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
        <Text style={styles.subtitle}>Verify your BVN or NIN to unlock loans, BOA credit, and bank-grade trust.</Text>

        {/* Toggle */}
        <View style={styles.tabRow}>
          <Pressable onPress={() => { setMode('bvn'); setResult(null); }} style={[styles.tabBtn, mode === 'bvn' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, mode === 'bvn' && styles.tabTextActive]}>Verify BVN</Text>
          </Pressable>
          <Pressable onPress={() => { setMode('nin'); setResult(null); }} style={[styles.tabBtn, mode === 'nin' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, mode === 'nin' && styles.tabTextActive]}>Verify NIN</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{mode.toUpperCase()} NUMBER (11 DIGITS)</Text>
        <TextInput
          value={idNumber}
          onChangeText={setIdNumber}
          keyboardType="number-pad"
          maxLength={11}
          placeholder="e.g. 22222222222"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Pressable onPress={handleVerify} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>VERIFY IDENTITY</Text>}
        </Pressable>

        {/* RESULT */}
        {result && (
          <View style={[styles.resultBox, { borderColor: result.success ? '#00ff88' : '#ff3b5c' }]}>
            <Text style={[styles.resultTitle, { color: result.success ? '#00ff88' : '#ff3b5c' }]}>
              {result.success ? '✅ Verified' : '❌ Verification Failed'}
            </Text>
            <Text style={styles.resultMsg}>{result.message}</Text>

            {result.success && result.data && (
              <View style={styles.dataBox}>
                <Text style={styles.dataRow}><Text style={styles.dataLabel}>Name:</Text> {result.data.firstName} {result.data.lastName}</Text>
                <Text style={styles.dataRow}><Text style={styles.dataLabel}>DOB:</Text> {result.data.dateOfBirth}</Text>
                <Text style={styles.dataRow}><Text style={styles.dataLabel}>Phone:</Text> {result.data.phone}</Text>
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
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.15)' },
  tabText: { fontSize: 13, fontWeight: '700', color: p.textMuted },
  tabTextActive: { color: p.neon },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 16, letterSpacing: 2, marginBottom: 20 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  resultBox: { marginTop: 24, padding: 20, borderRadius: 16, borderWidth: 2, backgroundColor: p.surface },
  resultTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  resultMsg: { fontSize: 13, color: p.textMuted, marginBottom: 16 },
  dataBox: { gap: 8 },
  dataRow: { fontSize: 14, color: p.text },
  dataLabel: { fontWeight: '800', color: p.neon },
});
