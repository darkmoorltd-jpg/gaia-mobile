import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function BoaCustomerEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; loan_id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facility, setFacility] = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [nextAmt, setNextAmt] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!params.id) { setBusy(false); return; }
    setBusy(true);
    const { data: r } = await supabase.rpc('boa_borrower_detail', { p_user_id: params.id });
    setData(r);
    const loan = (r?.loans || []).find((l: any) => l.id === params.loan_id) || (r?.loans || [])[0];
    if (loan) {
      setFacility(String(loan.facility_amount || 0));
      setOutstanding(String(loan.outstanding || 0));
      setNextAmt(String(loan.next_payment_amount || 0));
      setNextDate(loan.next_payment_date ? String(loan.next_payment_date).slice(0, 10) : '');
      setStatus(loan.status || 'active');
    }
    setBusy(false);
  }, [params.id, params.loan_id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const loanId = params.loan_id || (data?.loans || [])[0]?.id;
    if (!loanId) { Alert.alert('No loan selected'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('boa_update_loan', {
      p_loan_id: loanId,
      p_facility_amount: facility ? parseFloat(facility) : null,
      p_outstanding: outstanding ? parseFloat(outstanding) : null,
      p_next_payment_amount: nextAmt ? parseFloat(nextAmt) : null,
      p_next_payment_date: nextDate || null,
      p_status: status || null,
    });
    setSaving(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Saved', 'Loan record updated.');
    load();
  };

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  const profile = data?.profile || {};
  const user = data?.user || {};

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Edit BOA Account</Text>
        <Text style={styles.sub}>
          {(profile.first_name || '') + ' ' + (profile.last_name || '')} · {user.email}
        </Text>

        <Text style={styles.section}>LOAN FIELDS</Text>
        <Text style={styles.label}>FACILITY AMOUNT (₦)</Text>
        <TextInput value={facility} onChangeText={setFacility} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>OUTSTANDING (₦)</Text>
        <TextInput value={outstanding} onChangeText={setOutstanding} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>NEXT PAYMENT AMOUNT (₦)</Text>
        <TextInput value={nextAmt} onChangeText={setNextAmt} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>NEXT PAYMENT DATE (YYYY-MM-DD)</Text>
        <TextInput value={nextDate} onChangeText={setNextDate} placeholder="2026-03-15" style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>STATUS</Text>
        <View style={styles.chips}>
          {['onboarded', 'active', 'restructured', 'overdue', 'closed'].map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipOn]}>
              <Text style={[styles.chipText, status === s && styles.chipTextOn]}>{s.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={save} disabled={saving} style={styles.cta}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>SAVE CHANGES</Text>}
        </Pressable>

        <Text style={styles.section}>CUSTOMER SNAPSHOT</Text>
        <Text style={styles.kv}>📞 {profile.phone || '—'}</Text>
        <Text style={styles.kv}>📍 {profile.state || '—'} · {profile.lga || '—'}</Text>
        <Text style={styles.kv}>🌾 {profile.primary_crops || '—'}</Text>
        <Text style={styles.kv}>📐 Farm size: {profile.farm_size_acres || 0} acres</Text>
        <Text style={styles.kv}>🔒 KYC: {profile.verification_status || 'pending'}</Text>

        <Pressable onPress={() => router.push(('/boa-borrower?id=' + params.id) as any)} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>VIEW FULL PROFILE (FARM, SCANS, MAP)</Text>
        </Pressable>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  center: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  section: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.neon, marginTop: 24, marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  cta: { marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  kv: { fontSize: 12, color: p.text, marginBottom: 6 },
  secondaryBtn: { marginTop: 16, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  secondaryText: { fontSize: 11, fontWeight: '900', color: p.text, letterSpacing: 1 },
});
