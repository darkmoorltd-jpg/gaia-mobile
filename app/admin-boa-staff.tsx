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

  const [identifier, setIdentifier] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchedUser, setSearchedUser] = useState<any>(null);
  
  const [role, setRole] = useState<'boa_manager' | 'boa_officer'>('boa_officer');
  const [zone, setZone] = useState('');
  const [busy, setBusy] = useState(false);
  
  const [staff, setStaff] = useState<any[]>([]);

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from('user_profiles')
      .select('user_id, email, first_name, last_name, role')
      .in('role', ['boa_manager', 'boa_officer']);
    setStaff(data || []);
  }, []);

  useFocusEffect(useCallback(() => { loadStaff(); }, [loadStaff]));

  const findUser = async () => {
    if (!identifier) { Alert.alert('Enter email or phone'); return; }
    setSearching(true);
    setSearchedUser(null);
    
    const { data, error } = await supabase.rpc('admin_get_user_by_identifier', { p_identifier: identifier.trim() });
    
    setSearching(false);
    if (error) { Alert.alert('Error', error.message); return; }
    if (!data.ok) { Alert.alert('Not Found', data.message); return; }
    
    setSearchedUser(data.user);
  };

  const promote = async () => {
    if (!searchedUser) return;
    setBusy(true);
    
    const fullName = `${searchedUser.first_name || ''} ${searchedUser.last_name || ''}`.trim();
    
    const { data, error } = await supabase.rpc('admin_promote_to_boa', {
      p_email: searchedUser.email,
      p_role: role,
      p_full_name: fullName || null,
      p_zone: zone || null,
      p_phone: searchedUser.phone || null,
    });
    
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    if (!data.ok) { Alert.alert('Failed', data.message); return; }
    
    Alert.alert('Success', `${searchedUser.email} is now a ${role.replace('boa_', '')}`);
    setIdentifier(''); setSearchedUser(null); setZone('');
    loadStaff();
  };

  const revoke = (target: any) => {
    Alert.alert('Revoke BOA access?', target.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_revoke_boa', { p_email: target.email });
        if (error) Alert.alert('Failed', error.message);
        else loadStaff();
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Admin only</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>BOA Staff Access</Text>
        <Text style={styles.sub}>Search a user by email or phone to view their KYC profile</Text>

        {/* SEARCH BOX */}
        <View style={styles.searchBox}>
          <TextInput 
            value={identifier} 
            onChangeText={setIdentifier} 
            placeholder="Email or Phone (e.g. 08031234567)"
            placeholderTextColor={palette.textDim} 
            style={styles.input} 
            autoCapitalize="none" 
            keyboardType="email-address"
          />
          <Pressable onPress={findUser} disabled={searching} style={styles.searchBtn}>
            {searching ? <ActivityIndicator color="#000" /> : <Text style={styles.searchBtnText}>SEARCH</Text>}
          </Pressable>
        </View>

        {/* USER PROFILE CARD */}
        {searchedUser ? (
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(searchedUser.first_name || 'U').charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{searchedUser.first_name} {searchedUser.last_name}</Text>
                <Text style={styles.profileEmail}>{searchedUser.email}</Text>
                <Text style={styles.profileRole}>Current Role: {searchedUser.role || 'farmer'}</Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>Phone</Text>
                <Text style={styles.detailV}>{searchedUser.phone || '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>Gender</Text>
                <Text style={styles.detailV}>{searchedUser.gender || '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>DOB</Text>
                <Text style={styles.detailV}>{searchedUser.date_of_birth || '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>State</Text>
                <Text style={styles.detailV}>{searchedUser.state || '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>LGA</Text>
                <Text style={styles.detailV}>{searchedUser.lga || '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>KYC Status</Text>
                <Text style={[styles.detailV, { color: searchedUser.verification_status === 'approved' ? '#00ff88' : '#ffb300' }]}>
                  {searchedUser.verification_status || 'pending'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>BVN</Text>
                <Text style={styles.detailV}>{searchedUser.bvn || '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>NIN</Text>
                <Text style={styles.detailV}>{searchedUser.nin || '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>Farm Size</Text>
                <Text style={styles.detailV}>{searchedUser.farm_size_acres || 0} acres</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailL}>Primary Crops</Text>
                <Text style={styles.detailV}>{searchedUser.primary_crops || '—'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>ASSIGN BOA ROLE</Text>
            <View style={styles.chips}>
              <Pressable onPress={() => setRole('boa_officer')} style={[styles.chip, role === 'boa_officer' && styles.chipOn]}>
                <Text style={[styles.chipText, role === 'boa_officer' && styles.chipTextOn]}>FIELD OFFICER</Text>
              </Pressable>
              <Pressable onPress={() => setRole('boa_manager')} style={[styles.chip, role === 'boa_manager' && styles.chipOn]}>
                <Text style={[styles.chipText, role === 'boa_manager' && styles.chipTextOn]}>MANAGER</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>ZONE (for officers)</Text>
            <TextInput value={zone} onChangeText={setZone} placeholder="e.g. Kaduna North"
              placeholderTextColor={palette.textDim} style={styles.input} />

            <Pressable onPress={promote} disabled={busy} style={styles.cta}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>GRANT BOA ACCESS</Text>}
            </Pressable>
          </View>
        ) : null}

        {/* ACTIVE STAFF LIST */}
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
  searchBox: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  input: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  searchBtn: { paddingHorizontal: 20, borderRadius: 10, backgroundColor: p.neon, justifyContent: 'center' },
  searchBtnText: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  
  profileCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.neon, marginBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '900', color: p.neon },
  profileName: { fontSize: 20, fontWeight: '900', color: p.text },
  profileEmail: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  profileRole: { fontSize: 10, fontWeight: '800', color: p.neon, marginTop: 4, letterSpacing: 1 },
  
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: { width: '47%', paddingVertical: 6 },
  detailL: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  detailV: { fontSize: 13, fontWeight: '700', color: p.text, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 16 },
  
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  cta: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  
  section: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5, marginTop: 10, marginBottom: 10 },
  staffRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  staffEmail: { fontSize: 13, fontWeight: '700', color: p.text },
  staffRole: { fontSize: 10, fontWeight: '800', color: p.neon, marginTop: 2, letterSpacing: 1 },
  revokeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ff3b5c' },
  revokeText: { fontSize: 10, fontWeight: '900', color: '#ff3b5c' },
  
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 18, fontWeight: '900', color: p.danger },
});
