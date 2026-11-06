import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function WarehouseRegister() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [cac, setCac] = useState('');
  const [tin, setTin] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [state, setState] = useState('Lagos');
  const [address, setAddress] = useState('');
  const [years, setYears] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('warehouse_companies').select('*').eq('owner_id', user.id).maybeSingle();
    setCompany(data);
    setLoading(false);
  };

  useFocusEffect(React.useCallback(() => { load(); }, [user]));

  const submit = async () => {
    if (!name.trim() || !cac.trim() || !contactName.trim() || !contactPhone.trim() || !contactEmail.trim() || !address.trim()) {
      Alert.alert('Missing fields', 'Please fill all required fields.'); return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('register_warehouse_company', {
      p_company_name: name.trim(),
      p_cac_registration: cac.trim().toUpperCase(),
      p_tin: tin.trim() || null,
      p_contact_person: contactName.trim(),
      p_contact_phone: contactPhone.trim(),
      p_contact_email: contactEmail.trim().toLowerCase(),
      p_state: state,
      p_address: address.trim(),
      p_years_in_business: parseInt(years) || 0,
      p_documents: [],
      p_photos: [],
    });
    setBusy(false);
    if (error) { Alert.alert('Registration failed', error.message); return; }
    Alert.alert('Submitted!', 'Your application is pending admin review (1-3 business days).');
    load();
  };

  if (loading) return <View style={styles.container}><ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} /></View>;

  if (company) {
    const st = company.verification_status;
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Company Status</Text>
          <View style={styles.statusCard}>
            <Text style={styles.companyName}>{company.company_name}</Text>
            <Text style={styles.cacText}>CAC: {company.cac_registration}</Text>
            <View style={[styles.statusBadge, { borderColor: st === 'approved' ? palette.neon : st === 'pending' ? '#ffb300' : '#ff3b5c' }]}>
              <Text style={[styles.statusText, { color: st === 'approved' ? palette.neon : st === 'pending' ? '#ffb300' : '#ff3b5c' }]}>
                {st.toUpperCase()}
              </Text>
            </View>
            {st === 'pending' && <Text style={styles.hintText}>⏳ Admin is reviewing your application. Expect 1-3 business days.</Text>}
            {st === 'rejected' && <Text style={styles.hintText}>❌ {company.rejection_reason || 'Application rejected. Contact support.'}</Text>}
            {st === 'approved' && !company.onboarding_fee_paid && (
              <>
                <Text style={styles.hintText}>✅ Approved! Pay ₦100,000 onboarding fee to activate your account and start adding units.</Text>
                <Pressable onPress={() => router.push('/warehouse-onboarding-pay' as any)} style={styles.cta}>
                  <Text style={styles.ctaText}>PAY ₦100,000 ONBOARDING FEE</Text>
                </Pressable>
              </>
            )}
            {st === 'approved' && company.onboarding_fee_paid && (
              <>
                <Text style={styles.hintText}>🎉 Fully activated! Go to your dashboard to add units.</Text>
                <Pressable onPress={() => router.push('/warehouse-dashboard' as any)} style={styles.cta}>
                  <Text style={styles.ctaText}>GO TO MY DASHBOARD</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Register Warehouse Company</Text>
        <Text style={styles.sub}>Free to apply. Admin verifies. Then pay ₦100,000 to activate.</Text>

        <Text style={styles.sectionLabel}>COMPANY</Text>
        <Text style={styles.label}>COMPANY NAME *</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={palette.textDim} placeholder="e.g. Kano Cold Storage Ltd" />
        <Text style={styles.label}>CAC REGISTRATION NUMBER *</Text>
        <TextInput value={cac} onChangeText={setCac} style={styles.input} placeholderTextColor={palette.textDim} placeholder="RC-1234567" autoCapitalize="characters" />
        <Text style={styles.label}>TIN (optional)</Text>
        <TextInput value={tin} onChangeText={setTin} style={styles.input} placeholderTextColor={palette.textDim} placeholder="Tax ID" />
        <Text style={styles.label}>YEARS IN BUSINESS</Text>
        <TextInput value={years} onChangeText={setYears} keyboardType="number-pad" style={styles.input} placeholderTextColor={palette.textDim} placeholder="e.g. 5" />

        <Text style={styles.sectionLabel}>CONTACT</Text>
        <Text style={styles.label}>CONTACT PERSON *</Text>
        <TextInput value={contactName} onChangeText={setContactName} style={styles.input} placeholderTextColor={palette.textDim} />
        <Text style={styles.label}>PHONE *</Text>
        <TextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} placeholder="080..." />
        <Text style={styles.label}>EMAIL *</Text>
        <TextInput value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.sectionLabel}>HEAD OFFICE</Text>
        <Text style={styles.label}>STATE *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
          {NIGERIAN_STATES.map((s) => (
            <Pressable key={s} onPress={() => setState(s)} style={[styles.chip, state === s && styles.chipOn]}>
              <Text style={[styles.chipText, state === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>ADDRESS *</Text>
        <TextInput value={address} onChangeText={setAddress} multiline style={[styles.input, { minHeight: 70 }]} placeholderTextColor={palette.textDim} />

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SUBMIT APPLICATION</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 4 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  statusCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginTop: 20 },
  companyName: { fontSize: 22, fontWeight: '900', color: p.text },
  cacText: { fontSize: 13, color: p.textMuted, marginTop: 4, fontFamily: 'monospace' },
  statusBadge: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  hintText: { fontSize: 13, color: p.text, marginTop: 16, lineHeight: 20 },
});
