import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });

export default function MinistryFarmerRegistry() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [cropFilter, setCropFilter] = useState<string>('all');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('ministry_farmer_registry', {
      p_state: stateFilter === 'all' ? null : stateFilter,
      p_crop: cropFilter === 'all' ? null : cropFilter,
      p_search: search || null,
    });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin, search, stateFilter, cropFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [search]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const verifiedPct = data?.total_farmers > 0
    ? ((data.verified_farmers / data.total_farmers) * 100).toFixed(1) : '0.0';
  const activePct = data?.total_farmers > 0
    ? ((data.active_farmers / data.total_farmers) * 100).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Farmer Registry</Text>
        <Text style={styles.sub}>National verified database</Text>

        <View style={styles.heroRow}>
          <View style={styles.heroCard}>
            <Text style={styles.heroVal}>{num(data?.total_farmers)}</Text>
            <Text style={styles.heroLbl}>TOTAL</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#00ff88' }]}>{verifiedPct}%</Text>
            <Text style={styles.heroLbl}>VERIFIED</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#4fc3f7' }]}>{activePct}%</Text>
            <Text style={styles.heroLbl}>ACTIVE</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.verified_farmers)}</Text>
            <Text style={styles.kpiLbl}>KYC COMPLETE</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.active_farmers)}</Text>
            <Text style={styles.kpiLbl}>USED 30D</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.total_hectares, 1)}</Text>
            <Text style={styles.kpiLbl}>HECTARES</Text>
          </View>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, email, or phone..."
          placeholderTextColor={palette.textDim}
          style={styles.input}
          autoCapitalize="none"
        />

        {(data?.states_available || []).length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <Pressable onPress={() => setStateFilter('all')} style={[styles.chip, stateFilter === 'all' && styles.chipOn]}>
              <Text style={[styles.chipText, stateFilter === 'all' && styles.chipTextOn]}>ALL STATES</Text>
            </Pressable>
            {(data?.states_available || []).map((s: string) => (
              <Pressable key={s} onPress={() => setStateFilter(s)} style={[styles.chip, stateFilter === s && styles.chipOn]}>
                <Text style={[styles.chipText, stateFilter === s && styles.chipTextOn]}>{String(s).toUpperCase()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {(data?.crops_available || []).length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <Pressable onPress={() => setCropFilter('all')} style={[styles.chip, cropFilter === 'all' && styles.chipOn]}>
              <Text style={[styles.chipText, cropFilter === 'all' && styles.chipTextOn]}>ALL CROPS</Text>
            </Pressable>
            {(data?.crops_available || []).slice(0, 20).map((c: string) => (
              <Pressable key={c} onPress={() => setCropFilter(c)} style={[styles.chip, cropFilter === c && styles.chipOn]}>
                <Text style={[styles.chipText, cropFilter === c && styles.chipTextOn]}>{String(c).toUpperCase()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>BY STATE</Text>
        {(data?.by_state || []).length === 0 ? <Text style={styles.kv}>No data.</Text> :
          (data?.by_state || []).slice(0, 10).map((s: any, i: number) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{s.state}</Text>
              <Text style={styles.rowMeta}>{s.verified} verified · {s.active} active</Text>
              <Text style={styles.rowValue}>{s.farmers}</Text>
            </View>
          ))}

        <Text style={styles.sectionLabel}>FARMERS ({Math.min(200, (data?.farmers || []).length)})</Text>
        {(data?.farmers || []).length === 0 ? <Text style={styles.kv}>No farmers match this filter.</Text> :
          (data?.farmers || []).map((f: any, i: number) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {((f.first_name || '') + ' ' + (f.last_name || '')).trim() || f.email}
                </Text>
                {f.verification_status === 'approved' ? <Text style={styles.cardBadge}>VERIFIED</Text> : null}
              </View>
              <Text style={styles.cardMeta} numberOfLines={1}>{f.email}{f.phone ? ' · ' + f.phone : ''}</Text>
              <Text style={styles.cardMeta}>{f.state}{f.lga ? ' · ' + f.lga : ''} · {f.crop || 'no crop'} · {num(f.farm_size_acres, 1)} ac</Text>
              <Text style={styles.cardMeta}>{f.scan_count} scans · last seen {f.last_seen ? new Date(f.last_seen).toLocaleDateString() : 'never'}</Text>
            </View>
          ))}

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
  heroRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  heroCard: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  heroVal: { fontSize: 20, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  heroLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 15, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 3 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 12 },
  chipScroll: { gap: 6, paddingRight: 16, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 12, color: p.textMuted },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { fontSize: 13, fontWeight: '800', color: p.text },
  rowMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  rowValue: { fontSize: 16, fontWeight: '900', color: '#00ff88', position: 'absolute', right: 0, top: 10 },
  card: { padding: 12, borderRadius: 12, backgroundColor: p.surface, marginBottom: 6, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardName: { fontSize: 13, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  cardBadge: { fontSize: 8, fontWeight: '900', color: '#00ff88', letterSpacing: 1, backgroundColor: 'rgba(0,255,136,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cardMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
