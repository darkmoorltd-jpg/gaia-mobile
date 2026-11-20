import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

export default function MinistryDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('ministry_farmer_stats');
    if (!error) setStats(data);
    setBusy(false);
  }, []);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: refresh every 30s
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (busy && !stats) return <View style={styles.center}><ActivityIndicator color={palette.neon} size="large" /></View>;

  const scope = stats?.scope || {};
  const level = scope.level || 'none';
  const scopeLabel = level === 'federal' ? 'FEDERAL — All Nigeria' : level === 'ifad' ? 'IFAD — All Nigeria' : level === 'state' ? `STATE — ${scope.state}` : 'No Access';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>
        <View style={styles.header}>
          <Text style={styles.org}>{scope.org || 'Ministry of Agriculture'}</Text>
          <Text style={styles.scope}>{scopeLabel}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBig}>
            <Text style={styles.kpiBigNum}>{Number(stats?.total_farmers || 0).toLocaleString()}</Text>
            <Text style={styles.kpiBigLbl}>TOTAL FARMERS</Text>
          </View>
          <View style={styles.kpiBig}>
            <Text style={[styles.kpiBigNum, { color: palette.neon }]}>{Number(stats?.verified_farmers || 0).toLocaleString()}</Text>
            <Text style={styles.kpiBigLbl}>NIN VERIFIED</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiSmall}>
            <Text style={styles.kpiSmallNum}>{Number(stats?.with_polygon || 0).toLocaleString()}</Text>
            <Text style={styles.kpiSmallLbl}>WITH POLYGON</Text>
          </View>
          <View style={styles.kpiSmall}>
            <Text style={[styles.kpiSmallNum, { color: palette.neon }]}>{Number(stats?.ndvi_healthy || 0).toLocaleString()}</Text>
            <Text style={styles.kpiSmallLbl}>CROPS HEALTHY</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/ministry/farmers' as any)} style={styles.cta}>
          <Text style={styles.ctaTxt}>VIEW FARMERS ({stats?.total_farmers || 0})</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/ministry/map' as any)} style={[styles.cta, { backgroundColor: '#3b82f6' }]}>
          <Text style={[styles.ctaTxt, { color: '#fff' }]}>OPEN MAP</Text>
        </Pressable>

        <Text style={styles.sectionLbl}>BY STATE</Text>
        {(stats?.by_state || []).map((s: any, i: number) => (
          <View key={i} style={styles.barRow}>
            <Text style={styles.barLabel}>{s.state || 'Unknown'}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.min(100, (s.count / (stats?.total_farmers || 1)) * 100)}%` }]} />
            </View>
            <Text style={styles.barCount}>{s.count}</Text>
          </View>
        ))}

        <Text style={styles.sectionLbl}>BY SEX</Text>
        <View style={styles.pieRow}>
          {(stats?.by_sex || []).map((s: any, i: number) => (
            <View key={i} style={styles.pieItem}>
              <Text style={styles.pieNum}>{s.count}</Text>
              <Text style={styles.pieLbl}>{String(s.sex || 'unspecified').toUpperCase()}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLbl}>BY AGE</Text>
        <View style={styles.pieRow}>
          {(stats?.by_age || []).map((a: any, i: number) => (
            <View key={i} style={styles.pieItem}>
              <Text style={styles.pieNum}>{a.count}</Text>
              <Text style={styles.pieLbl}>{a.age_range}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLbl}>TOP LGAs</Text>
        {(stats?.by_lga || []).slice(0, 10).map((l: any, i: number) => (
          <View key={i} style={styles.lgaRow}>
            <Text style={styles.lgaName}>{l.lga}, {l.state}</Text>
            <Text style={styles.lgaCount}>{l.count}</Text>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  header: { marginBottom: 20 },
  org: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  scope: { fontSize: 12, color: p.neon, fontWeight: '700', marginTop: 4, letterSpacing: 1 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpiBig: { flex: 1, padding: 20, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiBigNum: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1 },
  kpiBigLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 1 },
  kpiSmall: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiSmallNum: { fontSize: 20, fontWeight: '900', color: p.text },
  kpiSmallLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 2, letterSpacing: 0.5 },
  cta: { marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  sectionLbl: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { fontSize: 12, color: p.text, width: 100, fontWeight: '700' },
  barTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 4 },
  barCount: { fontSize: 11, fontWeight: '900', color: p.textMuted, width: 60, textAlign: 'right' },
  pieRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pieItem: { flex: 1, minWidth: 80, padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  pieNum: { fontSize: 20, fontWeight: '900', color: p.text },
  pieLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 0.5 },
  lgaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  lgaName: { fontSize: 13, color: p.text },
  lgaCount: { fontSize: 13, fontWeight: '900', color: p.neon },
});
