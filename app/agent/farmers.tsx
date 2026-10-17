import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';
import { shareFarmerViaWhatsApp } from '../../src/utils/whatsapp';

const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString() : '-';
const FILTERS = [
  { key: 'all', label: 'ALL' },
  { key: 'registered', label: 'REGISTERED' },
  { key: 'pending', label: 'PENDING' },
  { key: 'approved', label: 'VERIFIED' },
  { key: 'rejected', label: 'REJECTED' },
];

export default function AgentFarmers() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await supabase.rpc('agent_my_farmers', { p_filter: filter, p_search: search || null, p_limit: 300 });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Farmers</Text>
        <Text style={styles.sub}>{rows.length} total</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search name, phone, email..." placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipOn]}>
              <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}
        {rows.map((r, i) => {
          const approved = r.bucket === 'approved';
          const pending = r.bucket === 'pending';
          const rejected = r.bucket === 'rejected';
          const color = approved ? '#00ff88' : pending ? '#ffb300' : rejected ? '#ff3b5c' : '#8899a6';
          const label = approved ? 'VERIFIED' : pending ? 'PENDING' : rejected ? 'REJECTED' : 'REGISTERED';
          return (
            <Pressable key={i} onPress={() => router.push(('/agent/verify?farmerId=' + r.user_id) as any)} style={styles.card}>
              <View style={[styles.avatar, { borderColor: color }]}>
                <Text style={[styles.avatarTxt, { color }]}>{(r.name || r.email || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{r.name || r.email}</Text>
                <Text style={styles.meta} numberOfLines={1}>{(r.state || '-') + (r.lga ? ' / ' + r.lga : '') + ' · ' + (r.primary_crops || 'no crop')}</Text>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusBadge, { color }]}>{label}</Text>
                  <Text style={styles.dateText}>{fmtDate(r.last_activity)}</Text>
                </View>
                {rejected && r.rejection_reason ? (
                  <Text style={styles.rejection} numberOfLines={2}>
                    Rejected: {r.rejection_reason}
                  </Text>
                ) : null}
                {r.payment_status === 'pending' && !approved ? (
                  <Text style={styles.paymentWarn} numberOfLines={1}>
                    Payment pending — N2,000 required
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {!busy && rows.length === 0 ? <View style={styles.empty}><Text style={styles.kv}>No farmers in this filter.</Text></View> : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 12 },
  chips: { gap: 6, paddingRight: 12, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textDim, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900' },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  statusBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  dateText: { fontSize: 9, color: p.textDim },
  rejection: { fontSize: 10, color: '#ff3b5c', marginTop: 6, fontStyle: 'italic' },
  paymentWarn: { fontSize: 10, color: '#ffb300', marginTop: 4, fontWeight: '700' },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted },
});
