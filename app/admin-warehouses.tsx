import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
type Tab = 'pending' | 'needs_info' | 'approved' | 'rejected' | 'all';

export default function AdminWarehouses() {
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
    const { data } = await supabase
      .from('warehouse_companies')
      .select('id, company_name, cac_registration, state, verification_status, created_at, viewed_at, reviewed_at, checklist, auto_flags, registration_fee_paid_at, documents, bank_verified_at, reference_1, reference_2, agreement_signed_at')
      .order('created_at', { ascending: true });
    if (data) setRows(data);
    setBusy(false);
  }, [isAdmin]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime subscription
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel('admin_warehouses_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_companies' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, load]);

  const stats = useMemo(() => {
    const cnt = (s: string) => rows.filter(r => r.verification_status === s).length;
    return {
      pending: cnt('pending'),
      needs_info: cnt('needs_info'),
      approved: cnt('approved'),
      rejected: cnt('rejected'),
      revenue: rows.filter(r => r.registration_fee_paid_at).length * 20000,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (tab !== 'all') r = r.filter(x => x.verification_status === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(x =>
        (x.company_name || '').toLowerCase().includes(q) ||
        (x.cac_registration || '').toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, tab, search]);

  const slaOf = (row: any) => {
    if (row.reviewed_at) return { color: '#888', hours: null, label: 'reviewed' };
    const ms = Date.now() - new Date(row.created_at).getTime();
    const hours = Math.floor(ms / 3600000);
    const color = hours >= 48 ? '#ff3b5c' : hours >= 24 ? '#ffb300' : palette.neon;
    return { color, hours, label: `${hours}h` };
  };

  if (!isAdmin) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>Access denied</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Warehouse Admin</Text>
        <Text style={styles.sub}>Review · approve · track revenue</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={[styles.statVal, { color: '#ffb300' }]}>{stats.pending}</Text><Text style={styles.statLbl}>PENDING</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: '#3b82f6' }]}>{stats.needs_info}</Text><Text style={styles.statLbl}>INFO</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: palette.neon }]}>{stats.approved}</Text><Text style={styles.statLbl}>APPROVED</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: '#ff3b5c' }]}>{stats.rejected}</Text><Text style={styles.statLbl}>REJECTED</Text></View>
        <View style={styles.stat}><Text style={styles.statVal}>₦{(stats.revenue / 1000).toFixed(0)}k</Text><Text style={styles.statLbl}>FEES</Text></View>
      </View>

      <View style={styles.tabRow}>
        {(['pending','needs_info','approved','rejected','all'] as Tab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabTxt, tab === t && { color: '#000' }]}>
              {t === 'needs_info' ? 'INFO' : t.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search company or CAC…"
          placeholderTextColor={palette.textDim}
          style={styles.search}
          autoCapitalize="none"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}
      >
        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && filtered.length === 0 ? (
          <Text style={styles.empty}>No applications in this tab.</Text>
        ) : null}

        {filtered.map(row => {
          const sla = slaOf(row);
          const docCount = Array.isArray(row.documents) ? row.documents.length : 0;
          const checklist = row.checklist || {};
          const doneCount = ['docs_match_cac','bank_matches_cac','has_real_photo','spoke_to_contact','called_ref_1','called_ref_2']
            .filter(k => checklist[k]?.done === true).length;
          const flags = Array.isArray(row.auto_flags) ? row.auto_flags : [];
          const statusColor =
            row.verification_status === 'approved' ? palette.neon :
            row.verification_status === 'pending' ? '#ffb300' :
            row.verification_status === 'needs_info' ? '#3b82f6' :
            row.verification_status === 'rejected' ? '#ff3b5c' : '#888';

          return (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/admin-warehouse-detail?id=${row.id}` as any)}
              style={[styles.card, { borderLeftColor: sla.color, borderLeftWidth: 4 }]}
            >
              <View style={styles.cardRow}>
                <Text style={styles.companyName} numberOfLines={1}>{row.company_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!row.viewed_at ? <View style={styles.unreadDot} /> : null}
                  {sla.hours != null ? (
                    <Text style={[styles.sla, { color: sla.color }]}>⏱ {sla.label}</Text>
                  ) : (
                    <Text style={styles.sla}>{sla.label}</Text>
                  )}
                </View>
              </View>

              <Text style={styles.meta}>
                {row.cac_registration || '—'} · {row.state || '—'}
              </Text>

              <View style={styles.chipsRow}>
                <View style={[styles.chipBadge, { borderColor: statusColor }]}>
                  <Text style={[styles.chipBadgeTxt, { color: statusColor }]}>
                    {String(row.verification_status).replace('_',' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.miniMeta}>
                  {docCount} docs · {row.bank_verified_at ? 'bank ✓' : 'bank pending'} · {doneCount}/6 checks
                </Text>
              </View>

              {flags.length > 0 ? (
                <View style={styles.flagsRow}>
                  {flags.slice(0, 2).map((f: any, i: number) => (
                    <Text key={i} style={styles.flag}>⚠ {typeof f === 'string' ? f : f.label || JSON.stringify(f)}</Text>
                  ))}
                </View>
              ) : null}

              {row.registration_fee_paid_at ? (
                <Text style={styles.paidHint}>💵 Registration fee paid</Text>
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
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabTxt: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 0.5 },
  searchWrap: { paddingHorizontal: 20, marginBottom: 8 },
  search: { padding: 12, borderRadius: 10, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  companyName: { fontSize: 15, fontWeight: '900', color: p.text, flex: 1, paddingRight: 8 },
  sla: { fontSize: 11, fontWeight: '900' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 2, fontFamily: 'monospace' },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chipBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  chipBadgeTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  miniMeta: { fontSize: 10, color: p.textMuted, fontWeight: '700' },
  flagsRow: { marginTop: 8, gap: 4 },
  flag: { fontSize: 11, color: '#ffb300', fontWeight: '700' },
  paidHint: { fontSize: 11, color: p.neon, marginTop: 6, fontWeight: '700' },
});
