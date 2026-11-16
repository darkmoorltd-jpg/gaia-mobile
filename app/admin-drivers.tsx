import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
type Tab = 'pending' | 'active' | 'suspended' | 'rejected' | 'all';

export default function AdminDrivers() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.from('driver_profiles')
      .select('user_id, license_number, license_expiry, status, created_at, viewed_at, checklist, bank_verified_at, agreement_signed_at, nin, license_url, license_back_url, vehicle:vehicles(plate_number, capacity_tonnes, insurance_expiry)')
      .order('created_at', { ascending: true });
    if (data) setRows(data as any);
    setBusy(false);
  }, [isAdmin]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel('admin_drivers_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_profiles' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, load]);

  const stats = useMemo(() => {
    const cnt = (s: string) => rows.filter(r => r.status === s).length;
    const today = rows.filter(r => r.status === 'active').length;
    return { pending: cnt('pending'), active: today, suspended: cnt('suspended'), rejected: cnt('rejected') };
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (tab !== 'all') r = r.filter(x => x.status === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(x =>
        (x.license_number || '').toLowerCase().includes(q) ||
        (x.vehicle?.plate_number || '').toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, tab, search]);

  const flagsOf = (r: any): string[] => {
    const f: string[] = [];
    if (r.license_expiry && new Date(r.license_expiry) < new Date()) f.push('license expired');
    if (r.license_expiry) {
      const days = Math.floor((new Date(r.license_expiry).getTime() - Date.now()) / 86400000);
      if (days >= 0 && days < 60) f.push(`license expires in ${days}d`);
    }
    const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    if (v?.insurance_expiry && new Date(v.insurance_expiry) < new Date()) f.push('insurance expired');
    if (!r.agreement_signed_at) f.push('agreement not signed');
    if (!r.bank_verified_at) f.push('bank unverified');
    return f;
  };

  const slaOf = (r: any) => {
    if (r.status !== 'pending' || r.viewed_at) return null;
    const h = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3600000);
    return { color: h >= 48 ? '#ff3b5c' : h >= 24 ? '#ffb300' : palette.neon, label: `${h}h` };
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Driver Admin</Text>
        <Text style={styles.sub}>Review · approve · monitor</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={[styles.statVal, { color: '#ffb300' }]}>{stats.pending}</Text><Text style={styles.statLbl}>PENDING</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: palette.neon }]}>{stats.active}</Text><Text style={styles.statLbl}>ACTIVE</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: '#3b82f6' }]}>{stats.suspended}</Text><Text style={styles.statLbl}>SUSPENDED</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: '#ff3b5c' }]}>{stats.rejected}</Text><Text style={styles.statLbl}>REJECTED</Text></View>
      </View>

      <View style={styles.tabRow}>
        {(['pending','active','suspended','rejected','all'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === t && { color: '#000' }]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search license or plate…" placeholderTextColor={palette.textDim} style={styles.search} autoCapitalize="none" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>
        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && filtered.length === 0 ? <Text style={styles.empty}>No drivers in this tab.</Text> : null}

        {filtered.map(r => {
          const sla = slaOf(r);
          const flags = flagsOf(r);
          const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
          const statusColor =
            r.status === 'active' ? palette.neon :
            r.status === 'pending' ? '#ffb300' :
            r.status === 'suspended' ? '#3b82f6' : '#ff3b5c';

          return (
            <Pressable key={r.user_id} onPress={() => router.push(`/admin-driver-detail?id=${r.user_id}` as any)}
              style={[styles.card, { borderLeftColor: sla?.color || statusColor, borderLeftWidth: 4 }]}>
              <View style={styles.cardRow}>
                <Text style={styles.license} numberOfLines={1}>{r.license_number || '—'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!r.viewed_at && r.status === 'pending' ? <View style={styles.unreadDot} /> : null}
                  {sla ? <Text style={[styles.sla, { color: sla.color }]}>⏱ {sla.label}</Text> : null}
                </View>
              </View>
              <Text style={styles.meta}>{v?.plate_number || '—'} · {v?.capacity_tonnes || '—'}t</Text>
              <View style={styles.chipsRow}>
                <View style={[styles.chipBadge, { borderColor: statusColor }]}>
                  <Text style={[styles.chipBadgeTxt, { color: statusColor }]}>{String(r.status).toUpperCase()}</Text>
                </View>
                {flags.length > 0 ? <Text style={styles.flagTxt}>⚠ {flags.length} flag{flags.length > 1 ? 's' : ''}</Text> : null}
              </View>
              {flags.length > 0 ? (
                <View style={styles.flagsRow}>
                  {flags.slice(0, 2).map((f, i) => <Text key={i} style={styles.flag}>{f}</Text>)}
                </View>
              ) : null}
            </Pressable>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginTop: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: p.surface, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: p.border },
  statVal: { fontSize: 16, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, marginTop: 2, letterSpacing: 0.5 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 4, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabTxt: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 0.5 },
  searchWrap: { paddingHorizontal: 20, marginBottom: 8 },
  search: { padding: 12, borderRadius: 10, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  license: { fontSize: 15, fontWeight: '900', color: p.text, flex: 1, paddingRight: 8, fontFamily: 'monospace' },
  sla: { fontSize: 11, fontWeight: '900' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 2, fontFamily: 'monospace' },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chipBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  chipBadgeTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  flagTxt: { fontSize: 10, color: '#ffb300', fontWeight: '700' },
  flagsRow: { marginTop: 8, gap: 2 },
  flag: { fontSize: 11, color: '#ffb300', fontWeight: '700' },
});
