import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import Sparkline from '../src/components/Sparkline';

export default function VideoGrowth() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [sites, setSites] = useState<any[]>([]);
  const [sessionsBySite, setSessionsBySite] = useState<Record<string, any[]>>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data: s } = await supabase
      .from('growth_sites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSites(s || []);

    const map: Record<string, any[]> = {};
    for (const site of s || []) {
      const { data: sess } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('growth_site_id', site.id)
        .order('created_at', { ascending: true });
      map[site.id] = sess || [];
    }
    setSessionsBySite(map);
    setBusy(false); setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>GROWTH SITES</Text>
        <Text style={styles.title}>Growth Tracking</Text>
        <Text style={styles.sub}>Scan the same spot every week to see disease progression over time.</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {!busy && sites.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No sites yet</Text>
            <Text style={styles.emptySub}>
              Save a spot as a growth site during video scan to compare week over week.
            </Text>
          </View>
        ) : null}

        {sites.map((site) => {
          const sessions = sessionsBySite[site.id] || [];
          const healthSeries = sessions.map((s) => s.consensus_label?.toLowerCase().includes('healthy') ? 100 : 100 - (s.severity_pct || 0));
          const trend = healthSeries.length >= 2
            ? (healthSeries[healthSeries.length - 1] - healthSeries[0])
            : 0;
          const trendColor = trend > 0 ? palette.neon : (trend < -5 ? palette.danger : palette.warning);

          return (
            <View key={site.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.siteName}>{site.label || '(no label)'}</Text>
                <Text style={styles.siteCrop}>{(site.crop || '').replace('_', ' ').toUpperCase()}</Text>
              </View>
              <Text style={styles.siteMeta}>{sessions.length} sessions</Text>

              {sessions.length > 0 ? (
                <>
                  <View style={{ marginTop: 12 }}>
                    <Sparkline
                      values={healthSeries}
                      width={280}
                      height={44}
                      color={palette.neon}
                      label="HEALTH SCORE OVER TIME"
                    />
                  </View>
                  <View style={[styles.trendRow, { borderColor: trendColor }]}>
                    <Text style={[styles.trendVal, { color: trendColor }]}>
                      {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(0)}%
                    </Text>
                    <Text style={styles.trendLbl}>
                      {trend > 5 ? 'IMPROVING' : trend < -5 ? 'DECLINING' : 'STABLE'}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -0.5, marginTop: 4 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 6, marginBottom: 20, lineHeight: 18 },
  empty: { padding: 30, alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: p.text },
  emptySub: { fontSize: 12, color: p.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  card: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  siteName: { fontSize: 16, fontWeight: '900', color: p.text, flex: 1, marginRight: 8 },
  siteCrop: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  siteMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 10, borderRadius: 10, borderWidth: 1.5 },
  trendVal: { fontSize: 18, fontWeight: '900' },
  trendLbl: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted },
});
