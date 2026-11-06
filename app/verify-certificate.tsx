import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function VerifyCertificate() {
  const router = useRouter();
  const { palette } = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const styles = createStyles(palette);

  const [input, setInput] = useState(code || '');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const verify = useCallback(async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;
    setBusy(true);
    const { data } = await supabase.rpc('verify_certificate', { p_code: codeToVerify.trim().toUpperCase() });
    setResult(data);
    setBusy(false);
  }, []);

  useFocusEffect(useCallback(() => {
    if (code) verify(String(code));
  }, [code, verify]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>🔍 Verify Certificate</Text>
        <Text style={styles.sub}>Check if a GAIA Organic certificate is valid</Text>

        <TextInput value={input} onChangeText={setInput} placeholder="GAIA-CERT-XXXXXXXX" placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="characters" />
        <Pressable onPress={() => verify(input)} disabled={busy || !input.trim()} style={[styles.cta, (busy || !input.trim()) && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>VERIFY</Text>}
        </Pressable>

        {result ? (
          result.valid ? (
            <View style={[styles.resultBox, { borderColor: '#00ff88' }]}>
              <Text style={styles.bigIcon}>✅</Text>
              <Text style={[styles.verdict, { color: '#00ff88' }]}>CERTIFICATE VALID</Text>
              <View style={styles.detail}><Text style={styles.detailLabel}>Seller</Text><Text style={styles.detailVal}>{result.seller_name}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Location</Text><Text style={styles.detailVal}>{result.lga}, {result.state}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Inspection</Text><Text style={styles.detailVal}>{result.issued}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Valid Until</Text><Text style={styles.detailVal}>{new Date(result.expires).toLocaleDateString()}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Residue Test</Text><Text style={[styles.detailVal, { color: result.residue_passed ? '#00ff88' : '#ffb300' }]}>{result.residue_passed ? '✅ Passed' : '⚠️ Not tested'}</Text></View>
            </View>
          ) : (
            <View style={[styles.resultBox, { borderColor: '#ff3b5c' }]}>
              <Text style={styles.bigIcon}>❌</Text>
              <Text style={[styles.verdict, { color: '#ff3b5c' }]}>NOT VALID</Text>
              <Text style={styles.reason}>This certificate is either expired, revoked, or does not exist.</Text>
            </View>
          )
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 16, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  resultBox: { marginTop: 24, padding: 24, borderRadius: 16, borderWidth: 2, backgroundColor: p.surface, alignItems: 'center' },
  bigIcon: { fontSize: 60 },
  verdict: { fontSize: 20, fontWeight: '900', marginTop: 12, letterSpacing: 1 },
  reason: { fontSize: 12, color: p.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 18 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailLabel: { fontSize: 12, color: p.textMuted },
  detailVal: { fontSize: 13, fontWeight: '700', color: p.text },
});
