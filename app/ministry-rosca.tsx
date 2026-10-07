import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtN = (n: any, dp: number = 0) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });
const fmtM = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e9) return 'N' + (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};

export default function MinistryRosca() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('ministry_rosca_oversight', { p_state: null });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const byState = data?.by_state || [];
  const topGroups = data?.top_groups || [];
  const byVariant = data?.by_variant || [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.tag}>MINISTRY x ROSCA</Text>
        <Text style={styles.title}>Savings Oversight</Text>
        <Text style={styles.sub}>Ajo / Esusu / Adashe activity nationwide</Text>

        {busy && !data ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        <View style={styles.heroRow}>
          <View style={styles.heroCard}>
            <Text style={styles.heroVal}>{data?.total_groups || 0}</Text>
            <Text style={styles.heroLbl}>GROUPS</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#4fc3f7' }]}>{data?.total_members || 0}</Text>
            <Text style={styles.heroLbl}>MEMBERS</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#00ff88' }]}>{fmtM(data?.total_escrow)}</Text>
            <Text style={styles.heroLbl}>ESCROW</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: '#00ff88' }]}>{data?.active_groups || 0}</Text>
            <Text style={styles.kpiLbl}>ACTIVE</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: '#4fc3f7' }]}>{data?.completed_groups || 0}</Text>
            <Text style={styles.kpiLbl}>COMPLETED</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: '#ffb300' }]}>{data?.draft_groups || 0}</Text>
            <Text style={styles.kpiLbl}>DRAFT</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{fmtN(data?.avg_contribution)}</Text>
            <Text style={styles.kpiLbl}>AVG CONTRIB</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>BY STATE</Text>
        {byState.length === 0 ? <Text style={styles.kv}>No groups registered yet.</Text> :
          byState.map((s: any, i: number) => (
            <View key={i} style={styles.stateCard}>
              <View style={styles.stateHead}>
                <Text style={styles.stateName}>{s.state}</Text>
                <Text style={styles.stateEscrow}>{fmtM(s.escrow)}</Text>
              </View>
              <View style={styles.stateRow}>
                <View style={styles.stateStat}>
                  <Text style={styles.stateVal}>{s.groups}</Text>
                  <Text style={styles.stateLbl}>GROUPS</Text>
                </View>
                <View style={styles.stateStat}>
                  <Text style={styles.stateVal}>{s.members}</Text>
                  <Text style={styles.stateLbl}>MEMBERS</Text>
                </View>
                <View style={styles.stateStat}>
                  <Text style={styles.stateVal}>{s.active_groups}</Text>
                  <Text style={styles.stateLbl}>ACTIVE</Text>
                </View>
                <View style={styles.stateStat}>
                  <Text style={styles.stateVal}>{fmtN(s.avg_contribution)}</Text>
                  <Text style={styles.stateLbl}>AVG</Text>
                </View>
              </View>
            </View>
          ))}

        {byVariant.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>BY TRADITION</Text>
            <View style={styles.variantRow}>
              {byVariant.map((v: any, i: number) => (
                <View key={i} style={styles.variantChip}>
                  <Text style={styles.variantName}>{(v.variant || 'esusu').toUpperCase()}</Text>
                  <Text style={styles.variantCount}>{v.n}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>TOP GROUPS BY ESCROW</Text>
        {topGroups.length === 0 ? <Text style={styles.kv}>No groups yet.</Text> :
          topGroups.map((g: any, i: number) => (
            <View key={i} style={styles.groupCard}>
              <View style={styles.groupHead}>
                <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.groupEscrow}>{fmtM(g.escrow)}</Text>
              </View>
              <Text style={styles.groupMeta}>
                {g.state || '-'}{g.lga ? ' · ' + g.lga : ''} · {(g.variant || 'esusu').toUpperCase()} · {g.frequency}
              </Text>
              <View style={styles.groupRow}>
                <View style={styles.groupStat}>
                  <Text style={styles.groupVal}>{g.members}/{g.cycle_members}</Text>
                  <Text style={styles.groupLbl}>MEMBERS</Text>
                </View>
                <View style={styles.groupStat}>
                  <Text style={styles.groupVal}>{fmtN(g.contribution_amount)}</Text>
                  <Text style={styles.groupLbl}>CONTRIB</Text>
                </View>
                <View style={styles.groupStat}>
                  <Text style={[styles.groupVal, {
                    color: g.status === 'active' ? '#00ff88' :
                           g.status === 'completed' ? '#4fc3f7' : '#8899a6',
                  }]}>{(g.status || '').toUpperCase()}</Text>
                  <Text style={styles.groupLbl}>STATUS</Text>
                </View>
                <View style={styles.groupStat}>
                  <Text style={styles.groupVal} numberOfLines={1}>{g.owner_email ? g.owner_email.split('@')[0] : '-'}</Text>
                  <Text style={styles.groupLbl}>OWNER</Text>
                </View>
              </View>
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
  tag: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  heroRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  heroCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  heroVal: { fontSize: 18, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  heroLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 3 },
  kpiRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  kpi: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 14, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  kv: { fontSize: 12, color: p.textMuted },
  stateCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  stateHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  stateName: { fontSize: 14, fontWeight: '900', color: p.text },
  stateEscrow: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  stateRow: { flexDirection: 'row', gap: 8 },
  stateStat: { flex: 1 },
  stateVal: { fontSize: 12, fontWeight: '900', color: p.text },
  stateLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variantChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', alignItems: 'center' },
  variantName: { fontSize: 9, fontWeight: '900', color: '#00ff88', letterSpacing: 1.2 },
  variantCount: { fontSize: 14, fontWeight: '900', color: p.text, marginTop: 2 },
  groupCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  groupName: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1, marginRight: 8 },
  groupEscrow: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  groupMeta: { fontSize: 11, color: p.textMuted, marginBottom: 10 },
  groupRow: { flexDirection: 'row', gap: 8 },
  groupStat: { flex: 1 },
  groupVal: { fontSize: 11, fontWeight: '900', color: p.text },
  groupLbl: { fontSize: 7, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
