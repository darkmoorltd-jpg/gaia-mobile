import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

const ROLES = [
  { key: 'boa', label: 'BOA', color: '#00ff88', icon: '🏦' },
  { key: 'ministry', label: 'Ministry of Agriculture', color: '#ffb300', icon: '🏛️' },
  { key: 'marketplace_admin', label: 'Marketplace Admin', color: '#ff3b5c', icon: '🌍' },
  { key: 'input_provider_admin', label: 'Input Provider Admin', color: '#4fc3f7', icon: '🌾' },
  { key: 'verifier', label: 'Verifier', color: '#b388ff', icon: '✅' },
  { key: 'extension_officer', label: 'Extension Officer', color: '#ff9800', icon: '👨‍🌾' },
];

export default function AdminAccess() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('boa');
  const [expiresDays, setExpiresDays] = useState('');
  const [busy, setBusy] = useState(true);
  const [act, setAct] = useState(false);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.rpc('admin_list_roles');
    setRows(data || []);
    setBusy(false); setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const grant = async () => {
    if (!email.trim()) { Alert.alert('Enter email'); return; }
    setAct(true);
    const { error } = await supabase.rpc('admin_grant_role', {
      p_email: email.trim(),
      p_role: selectedRole,
      p_expires_days: expiresDays ? parseInt(expiresDays) : null,
      p_notes: null,
    });
    setAct(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Granted', `${selectedRole} access granted to ${email}`);
    setEmail(''); setExpiresDays('');
    load();
  };

  const revoke = (row: any) => {
    Alert.alert('Revoke access?', `Remove ${row.role} from ${row.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        setAct(true);
        const { error } = await supabase.rpc('admin_revoke_role', { p_email: row.email, p_role: row.role });
        setAct(false);
        if (error) { Alert.alert('Failed', error.message); return; }
        load();
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Access Control</Text>
        <Text style={styles.sub}>Grant portal access to any GAIA user by email</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>GRANT ACCESS</Text>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="user@example.com"
            placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>ROLE</Text>
          <View style={styles.rolesGrid}>
            {ROLES.map((r) => (
              <Pressable key={r.key} onPress={() => setSelectedRole(r.key)}
                style={[styles.roleChip, selectedRole === r.key && { borderColor: r.color, backgroundColor: r.color + '20' }]}>
                <Text style={styles.roleIcon}>{r.icon}</Text>
                <Text style={[styles.roleLabel, selectedRole === r.key && { color: r.color }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>EXPIRES IN DAYS (optional)</Text>
          <TextInput value={expiresDays} onChangeText={setExpiresDays} keyboardType="numeric"
            placeholder="leave blank = never expires" placeholderTextColor={palette.textDim} style={styles.input} />

          <Pressable onPress={grant} disabled={act} style={styles.cta}>
            {act ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>GRANT ACCESS</Text>}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>ALL ACCESS ({rows.length})</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {rows.length === 0 && !busy ? (
          <Text style={styles.empty}>No one has extra access yet.</Text>
        ) : rows.map((r, i) => {
          const role = ROLES.find((x) => x.key === r.role);
          const expired = r.expires_at && new Date(r.expires_at) < new Date();
          return (
            <View key={i} style={[styles.row, !r.is_active && { opacity: 0.4 }]}>
              <Text style={styles.rowIcon}>{role?.icon || '❓'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowEmail} numberOfLines={1}>{r.email}</Text>
                <Text style={[styles.rowRole, { color: role?.color || palette.textMuted }]}>
                  {(role?.label || r.role).toUpperCase()}
                  {expired ? ' · EXPIRED' : (!r.is_active ? ' · REVOKED' : '')}
                </Text>
                {r.expires_at ? (
                  <Text style={styles.rowMeta}>Expires {new Date(r.expires_at).toLocaleDateString()}</Text>
                ) : null}
              </View>
              {r.is_active && !expired ? (
                <Pressable disabled={act} onPress={() => revoke(r)} style={styles.revokeBtn}>
                  <Text style={styles.revokeText}>REVOKE</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { padding: 18, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 20 },
  cardTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 10, backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.border },
  roleIcon: { fontSize: 14 },
  roleLabel: { fontSize: 11, fontWeight: '800', color: p.textMuted },
  cta: { marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: '#00ff88', alignItems: 'center' },
  ctaText: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginBottom: 10 },
  empty: { fontSize: 12, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  rowIcon: { fontSize: 24 },
  rowEmail: { fontSize: 13, fontWeight: '800', color: p.text },
  rowRole: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  rowMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#ff3b5c' },
  revokeText: { fontSize: 9, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
  blocked: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
