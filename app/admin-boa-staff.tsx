import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminBoaStaff() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('');
  const [role, setRole] = useState<'boa_manager' | 'boa_officer'>('boa_officer');
  const [staff, setStaff] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('user_profiles')
      .select('user_id, email, first_name, last_name, role')
      .in('role', ['boa_manager', 'boa_officer']);
    setStaff(data || []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const promote = async () => {
    if (!email) { Alert.alert('Enter email'); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_promote_to_boa', {
      p_email: email.trim(),
      p_role: role,
      p_full_name: fullName || null,
      p_zone: zone || null,
      p_phone: phone || null,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    if (!data.ok) { Alert.alert('Failed', data.message); return; }
    
    Alert.alert('Success', `${email} is now a ${role.replace('boa_', '')}`);
    setEmail(''); setFullName(''); setPhone(''); setZone('');
    load();
  };

  const revoke = (target: any) => {
    Alert.alert('Revoke BOA access?', target.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_revoke_boa', { p_email: target.email });
        if (error) Alert.alert('Failed', error.message);
        else load();
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Admin only</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>BOA Staff Access</Text>
        <Text style={styles.sub}>Promote GAIA users to BOA Manager or Field Officer</Text>

        <View style={styles.card}>
          <Text style={styles.label}>GAIA EMAIL *</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="user@boa.gov.ng"
            placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" />

          <Text style={styles.label}>FULL NAME</Text>
          <TextInput value={fullName} onChangeText={setFullName} placeholder="e.g. Ibrahim Musa"
            placeholderTextColor={palette.textDim} style={styles.input} />

          <Text style={styles.label}>PHONE</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="08031234567"
            placeholderTextColor={palette.textDim} style={styles.input} keyboardType="phone-pad" />

          <Text style={styles.label}>ZONE (for officers)</Text>
          <TextInput value={zone} onChangeText={setZone} placeholder="e.g. Kaduna North"
            placeholderTextColor={palette.textDim} style={styles.input} />

          <Text style={styles.label}>ROLE</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setRole('boa_officer')} style={[styles.chip, role === 'boa_officer' && styles.chipOn]}>
              <Text style={[styles.chipText, role === 'boa_officer' && styles.chipTextOn]}>FIELD OFFICER</Text>
            </Pressable>
            <Pressable onPress={() => setRole('boa_manager')} style={[styles.chip, role === 'boa_manager' && styles.chipOn]}>
              <Text style={[styles.chipText, role === 'boa_manager' && styles.chipTextOn]}>MANAGER</Text>
            </Pressable>
          </View>

          <Pressable onPress={promote} disabled={busy} style={styles.cta}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>GRANT BOA ACCESS</Text>}
          </Pressable>
        </View>

        <Text style={styles.section}>ACTIVE BOA STAFF ({staff.length})</Text>
        {staff.map((s) => (
          <View key={s.user_id} style={styles.staffRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffEmail}>{s.email}</Text>
              <Text style={styles.staffRole}>{s.role.replace('boa_', '').toUpperCase()}</Text>
            </View>
            <Pressable onPress={() => revoke(s)} style={styles.revokeBtn}>
              <Text style={styles.revokeText}>REVOKE</Text>
            </Pressable>
          </View>
        ))}

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
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 10, backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  cta: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  section: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5, marginTop: 30, marginBottom: 10 },
  staffRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  staffEmail: { fontSize: 13, fontWeight: '700', color: p.text },
  staffRole: { fontSize: 10, fontWeight: '800', color: p.neon, marginTop: 2, letterSpacing: 1 },
  revokeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ff3b5c' },
  revokeText: { fontSize: 10, fontWeight: '900', color: '#ff3b5c' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 18, fontWeight: '900', color: p.danger },
});
