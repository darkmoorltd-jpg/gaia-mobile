import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminNDFRDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [m, setM] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_ndfr_metrics');
      if (!error) setM(data || {});
    } catch {}
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) return <View style={styles.blocked}><Text style={styles.blockedText}>Login required</Text></View>;

  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
  const total = m.total_farmers || 0;

  const Stat = ({ label, value, sub, color }: any) => (
    <View style={[styles.stat, color && { borderColor: color }]}>
      <Text style={[styles.statVal, color && { color }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );

  const Progress = ({ label, n, d }: any) => {
    const p = pct(n, d);
    const color = p >= 80 ? '#00ff88' : p >= 50 ? '#ffb300' : '#ff3b5c';
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.progLbl}>{label}</Text>
          <Text style={[styles.progVal, { color }]}>{p}%</Text>
        </View>
        <View style={styles.progTrack}>
          <View style={[styles.progFill, { width: `${p}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>NDFR Dashboard</Text>
        <Text style={styles.sub}>Ministry of Agriculture · Section 13.2 KPIs</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        <Text style={styles.sectionLabel}>REGISTRATION</Text>
        <View style={styles.grid}>
          <Stat label="TOTAL FARMERS" value={total} color={palette.neon} />
          <Stat label="AGENTS ACTIVE" value={m.agents_active ?? 0} />
          <Stat label="YOUTH FARMERS" value={m.youth ?? 0} sub={`${pct(m.youth, total)}% of total`} />
          <Stat label="VULNERABLE" value={m.vulnerable ?? 0} sub={`${pct(m.vulnerable, total)}%`} />
        </View>

        <Text style={styles.sectionLabel}>DATA COMPLETENESS</Text>
        <View style={styles.card}>
          <Progress label="NIN Captured" n={m.with_nin} d={total} />
          <Progress label="NIN Verified (NIMC)" n={m.nin_verified} d={total} />
          <Progress label="GPS Location" n={m.with_gps} d={total} />
          <Progress label="Farm Polygon" n={m.with_polygon} d={total} />
          <Progress label="NDPA Consent" n={m.with_consent} d={total} />
        </View>

        <Text style={styles.sectionLabel}>FINANCIAL INCLUSION</Text>
        <View style={styles.card}>
          <Progress label="Has Insurance" n={m.with_insurance} d={total} />
          <Progress label="Has Credit Access" n={m.with_credit} d={total} />
          <Progress label="Coop Member" n={m.with_coop} d={total} />
        </View>

        <Text style={styles.sectionLabel}>SERVICE DELIVERY</Text>
        <View style={styles.grid}>
          <Stat label="GRIEVANCES OPEN" value={m.grievances_open ?? 0} color={(m.grievances_open ?? 0) > 0 ? '#ffb300' : '#00ff88'} />
          <Stat label="DELETION REQUESTS" value={m.deletions_pending ?? 0} color={(m.deletions_pending ?? 0) > 0 ? '#ffb300' : '#00ff88'} />
        </View>

        <Text style={styles.sectionLabel}>TOP STATES</Text>
        <View style={styles.card}>
          {(m.by_state || []).length === 0 ? <Text style={styles.empty}>No data yet.</Text> :
            (m.by_state || []).slice(0, 8).map((s: any, i: number) => (
              <View key={i} style={styles.barRow}>
                <Text style={styles.barLbl}>{s.state}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, pct(s.n, total))}%` }]} />
                </View>
                <Text style={styles.barVal}>{s.n}</Text>
              </View>
            ))}
        </View>

        <Text style={styles.sectionLabel}>TOP CROPS</Text>
        <View style={styles.card}>
          {(m.top_crops || []).length === 0 ? <Text style={styles.empty}>No data yet.</Text> :
            (m.top_crops || []).map((c: any, i: number) => (
              <View key={i} style={styles.barRow}>
                <Text style={styles.barLbl}>{c.crop}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, pct(c.n, total))}%` }]} />
                </View>
                <Text style={styles.barVal}>{c.n}</Text>
              </View>
            ))}
        </View>

        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <Pressable onPress={() => router.push('/admin-users' as any)} style={styles.actionBtn}>
          <Text style={styles.actionTxt}>👥 VIEW ALL USERS</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/admin-audit' as any)} style={styles.actionBtn}>
          <Text style={styles.actionTxt}>📋 AUDIT LOG</Text>
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flex: 1, minWidth: '47%', padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '900', color: p.text },
  statLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 4, textAlign: 'center' },
  statSub: { fontSize: 10, color: p.textDim, marginTop: 2 },
  card: { backgroundColor: p.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: p.border },
  progLbl: { fontSize: 12, color: p.text },
  progVal: { fontSize: 12, fontWeight: '900' },
  progTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLbl: { width: 100, fontSize: 11, color: p.text },
  barTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 4 },
  barVal: { width: 40, fontSize: 11, color: p.textMuted, textAlign: 'right' },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  actionBtn: { marginTop: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  actionTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
