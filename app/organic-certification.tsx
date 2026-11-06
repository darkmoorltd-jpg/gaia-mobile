import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function OrganicCertification() {
  const router = useRouter();
  const { palette } = useTheme();
  const { sellerId } = useLocalSearchParams<{ sellerId?: string }>();
  const styles = createStyles(palette);

  const [sellers, setSellers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [residuePassed, setResiduePassed] = useState(false);
  const [residueUrl, setResidueUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  const load = useCallback(async () => {
    setBusy(true);
    if (sellerId) {
      const { data } = await supabase.from('organic_sellers').select('*').eq('id', sellerId).maybeSingle();
      if (data) setSelected(data);
    } else {
      const { data } = await supabase.from('organic_sellers').select('*').eq('status', 'active').order('business_name');
      setSellers(data || []);
    }
    setBusy(false);
  }, [sellerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!selected) return;
    if (!inspectionDate) { Alert.alert('Missing date'); return; }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('issue_certificate', {
      p_seller_id: selected.id,
      p_inspection_date: inspectionDate,
      p_residue_passed: residuePassed,
      p_residue_url: residueUrl.trim() || null,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setSuccess(data);
  };

  if (success) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Certification Issued</Text>
            <Text style={styles.successCode}>{success.certificate_code}</Text>
            <Text style={styles.successSub}>Valid until {new Date(success.valid_until).toLocaleDateString()}</Text>
            <Text style={styles.successHelp}>
              This code is now attached to {selected?.business_name}.
              Buyers can verify at /verify-certificate
            </Text>
            <Pressable onPress={() => router.replace('/admin-organic' as any)} style={styles.cta}>
              <Text style={styles.ctaText}>BACK TO ADMIN</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (selected) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Certify: {selected.business_name}</Text>
          <Text style={styles.sub}>📍 {selected.lga}, {selected.state}</Text>

          <Text style={styles.label}>INSPECTION DATE *</Text>
          <TextInput value={inspectionDate} onChangeText={setInspectionDate} style={styles.input} placeholderTextColor={palette.textDim} placeholder="YYYY-MM-DD" />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Residue Test Passed?</Text>
            <Switch value={residuePassed} onValueChange={setResiduePassed} trackColor={{ false: '#333', true: palette.neon }} />
          </View>

          <Text style={styles.label}>RESIDUE TEST REPORT URL (optional)</Text>
          <TextInput value={residueUrl} onChangeText={setResidueUrl} style={styles.input} placeholderTextColor={palette.textDim} placeholder="https://..." autoCapitalize="none" />

          <Text style={styles.label}>INSPECTOR NOTES</Text>
          <TextInput value={notes} onChangeText={setNotes} multiline style={[styles.input, { minHeight: 100 }]} placeholderTextColor={palette.textDim} placeholder="What did you observe? Compost use, no pesticides, etc." />

          <Pressable onPress={submit} disabled={submitting} style={[styles.cta, submitting && { opacity: 0.5 }]}>
            {submitting ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>ISSUE CERTIFICATE</Text>}
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Certify a Seller</Text>
        <Text style={styles.sub}>Select a seller to inspect and certify</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && sellers.length === 0 ? <Text style={styles.empty}>No active sellers to certify.</Text> : null}

        {sellers.map(s => (
          <Pressable key={s.id} onPress={() => setSelected(s)} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{s.business_name}</Text>
              <Text style={styles.meta}>📍 {s.lga}, {s.state}</Text>
              {s.is_certified ? <Text style={styles.certifiedTxt}>✅ Currently Certified</Text> : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  sellerName: { fontSize: 15, fontWeight: '900', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  certifiedTxt: { fontSize: 10, color: p.neon, fontWeight: '800', marginTop: 6 },
  chevron: { fontSize: 24, color: p.textDim },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6, letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  toggleLabel: { fontSize: 14, color: p.text, fontWeight: '700' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  successBox: { backgroundColor: p.surface, padding: 30, borderRadius: 20, borderWidth: 2, borderColor: p.neon, alignItems: 'center', marginTop: 40 },
  successIcon: { fontSize: 60 },
  successTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 16 },
  successCode: { fontSize: 16, fontWeight: '900', color: p.neon, fontFamily: 'monospace', marginTop: 16, backgroundColor: 'rgba(0,255,136,0.1)', padding: 12, borderRadius: 8, textAlign: 'center' },
  successSub: { fontSize: 12, color: p.textMuted, marginTop: 8 },
  successHelp: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 18, fontStyle: 'italic' },
});
