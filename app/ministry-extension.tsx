import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });

export default function MinistryExtension() {
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
    const r = await supabase.rpc('ministry_extension_impact', {});
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const zones = data?.by_zone || [];
  const avgVisits = data?.total_officers > 0
    ? (data.total_visits_90d / data.total_officers).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Extension Impact</Text>
        <Text style={styles.sub}>Officer reach and outcomes</Text>

        <View style={styles.heroRow}>
          <View style={styles.heroCard}>
            <Text style={styles.heroVal}>{num(data?.total_officers)}</Text>
            <Text style={styles.heroLbl}>OFFICERS</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#4fc3f7' }]}>{num(data?.total_visits_90d)}</Text>
            <Text style={styles.heroLbl}>VISITS 90D</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#00ff88' }]}>{avgVisits}</Text>
            <Text style={styles.heroLbl}>AVG/OFFICER</Text>
          </View>
        </View>

        <View style={styles.bigBox}>
          <Text style={styles.bigLabel}>FARMERS REACHED</Text>
          <Text style={styles.bigVal}>{num(data?.total_farmers_reached)}</Text>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>BY ZONE</Text>
        {zones.length === 0 ? <Text style={styles.kv}>No zone data.</Text> :
          zones.map((z: any, i: number) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardZone}>{z.zone}</Text>
                <Text style={styles.cardOfficers}>{z.officers} officers</Text>
              </View>
              <View style={styles.cardRow}>
                <View style={styles.cardStat}>
                  <Text style={styles.cardVal}>{num(z.visits_90d)}</Text>
                  <Text style={styles.cardLbl}>VISITS</Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={styles.cardVal}>{num(z.visits_per_officer, 1)}</Text>
                  <Text style={styles.cardLbl}>PER OFFICER</Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={styles.cardVal}>{num(z.farmers_reached)}</Text>
                  <Text style={styles.cardLbl}>FARMERS</Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={[styles.cardVal, { color: '#ffb300' }]}>{num(z.avg_trust, 0)}</Text>
                  <Text style={styles.cardLbl}>TRUST</Text>
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
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  heroRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  heroCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  heroVal: { fontSize: 18, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  heroLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  bigBox: { padding: 22, borderRadius: 20, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', marginBottom: 16 },
  bigLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  bigVal: { fontSize: 38, fontWeight: '900', color: '#00ff88', letterSpacing: -1.5, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 12, marginBottom: 8 },
  kv: { fontSize: 12, color: p.textMuted },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardZone: { fontSize: 14, fontWeight: '900', color: p.text },
  cardOfficers: { fontSize: 11, fontWeight: '800', color: '#4fc3f7' },
  cardRow: { flexDirection: 'row', gap: 8 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 12, fontWeight: '900', color: p.text },
  cardLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
