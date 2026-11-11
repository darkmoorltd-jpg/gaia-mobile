import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function BoaOnboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [identifier, setIdentifier] = useState('');
  const [zone, setZone] = useState('');
  const [crop, setCrop] = useState('');
  const [hectares, setHectares] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    if (!identifier.trim()) { Alert.alert('Enter email or phone'); return; }
    setBusy(true); setResult(null);
    const { data, error } = await supabase.rpc('boa_onboard_customer', {
      p_identifier: identifier.trim(),
      p_zone: zone || null,
      p_crop: crop || null,
      p_hectares: hectares ? parseFloat(hectares) : null,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setResult(data);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Onboard Customer</Text>
        <Text style={styles.sub}>Enter the customer's GAIA email or phone to add them to BOA</Text>

        <View style={styles.info}>
          <Text style={styles.infoText}>
            ⚠️ The customer must already have a GAIA account. They will be added as a BOA customer with a pending loan record.
          </Text>
        </View>

        <Text style={styles.label}>GAIA EMAIL OR PHONE *</Text>
        <TextInput value={identifier} onChangeText={setIdentifier}
          placeholder="user@example.com or 08031234567"
          placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" />

        <Text style={styles.label}>ZONE (optional)</Text>
        <TextInput value={zone} onChangeText={setZone} placeholder="e.g. Kaduna North"
          placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>CROP (optional)</Text>
        <TextInput value={crop} onChangeText={setCrop} placeholder="e.g. Maize"
          placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>FARM HECTARES (optional)</Text>
        <TextInput value={hectares} onChangeText={setHectares} keyboardType="numeric"
          placeholder="e.g. 2.5" placeholderTextColor={palette.textDim} style={styles.input} />

        <Pressable onPress={submit} disabled={busy} style={styles.cta}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>ONBOARD CUSTOMER</Text>}
        </Pressable>

        {result ? (
          <View style={[styles.resultCard, { borderColor: result.ok ? '#00ff88' : '#ff3b5c' }]}>
            <Text style={[styles.resultTitle, { color: result.ok ? '#00ff88' : '#ff3b5c' }]}>
              {result.ok ? '✅ SUCCESS' : '❌ FAILED'}
            </Text>
            <Text style={styles.resultText}>
              {result.ok ? `Customer added: ${result.email}` : result.message}
            </Text>
            {result.ok ? (
              <Pressable onPress={() => router.push('/boa-borrowers' as any)} style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>VIEW BORROWERS</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  info: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,179,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', marginBottom: 20 },
  infoText: { fontSize: 11, color: '#ffb300', lineHeight: 17 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  cta: { marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  resultCard: { marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5 },
  resultTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  resultText: { fontSize: 13, color: p.text },
  viewBtn: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center' },
  viewBtnText: { fontSize: 11, fontWeight: '900', color: '#00ff88', letterSpacing: 1.5 },
});
