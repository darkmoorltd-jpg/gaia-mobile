import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtM = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};

type Bucket = 'all' | 'healthy' | 'watch' | 'at_risk' | 'critical';

const BUCKETS: { k: Bucket; label: string; color: string }[] = [
  { k: 'all',      label: 'ALL',      color: '#8899a6' },
  { k: 'healthy',  label: 'HEALTHY',  color: '#00ff88' },
  { k: 'watch',    label: 'WATCH',    color: '#ffb300' },
  { k: 'at_risk',  label: 'AT RISK',  color: '#ff6b35' },
  { k: 'critical', label: 'CRITICAL', color: '#ff3b5c' },
];

export default function BoaBorrowers() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_list_borrowers', {
      p_search: search || null,
      p_bucket: bucket,
      p_zone: null,
      p_limit: 200,
    });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin, search, bucket]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [search]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Borrowers</Text>
        <Text style={styles.sub}>{rows.length} active · tap to open file</Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email..."
          placeholderTextColor={palette.textDim}
          style={styles.input}
          autoCapitalize="none"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {BUCKETS.map((b) => (
            <Pressable
              key={b.k}
              onPress={() => setBucket(b.k)}
              style={[styles.chip, bucket === b.k && { borderColor: b.color, backgroundColor: b.color + '20' }]}
            >
              <Text style={[styles.chipText, bucket === b.k && { color: b.color }]}>{b.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {rows.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No borrowers match this filter.</Text>
          </View>
        ) : rows.map((r) => {
          const trust = Number(r.trust_score ?? 50);
          const color = trust >= 80 ? '#00ff88' : trust >= 60 ? '#ffb300' : trust >= 40 ? '#ff6b35' : '#ff3b5c';
          return (
            <View key={r.user_id} style={styles.row}>
              <View style={[styles.avatar, { borderColor: color }]}>
                <Text style={[styles.avatarTxt, { color }]}>
                  {(r.name || r.email || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{r.name || r.email}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {r.zone || '-'} · {r.crop || '-'} · {r.loans || 0} loans
                </Text>
                <Text style={[styles.rowTrust, { color }]}>Trust {trust} · {r.bucket?.toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowOut}>{fmtM(r.outstanding)}</Text>
                <Text style={styles.rowMeta}>{r.last_seen ? new Date(r.last_seen).toLocaleDateString() : 'never'}</Text>
              </View>
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
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 12 },
  chips: { gap: 6, paddingRight: 16, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  empty: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900' },
  rowName: { fontSize: 14, fontWeight: '800', color: p.text },
  rowMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  rowTrust: { fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  rowOut: { fontSize: 14, fontWeight: '900', color: p.text },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
