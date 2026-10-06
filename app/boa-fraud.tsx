import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
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

export default function BoaFraud() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rings, setRings] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_fraud_rings', { p_distance_km: 0.5 });
    if (!r.error) setRings(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalExposure = rings.reduce((s, r) => s + Number(r.combined_exposure || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Fraud Rings</Text>
        <Text style={styles.sub}>Borrowers with GPS within 500m</Text>

        <View style={[styles.hero, { borderColor: 'rgba(255,59,92,0.3)', backgroundColor: 'rgba(255,59,92,0.06)' }]}>
          <Text style={styles.heroLabel}>SUSPECTED GROUPS</Text>
          <Text style={[styles.heroVal, { color: '#ff3b5c' }]}>{rings.length}</Text>
          <Text style={styles.heroMeta}>Combined exposure {fmtM(totalExposure)}</Text>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {rings.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No suspicious GPS clusters detected.</Text>
            <Text style={styles.kv} style={{ marginTop: 6, fontSize: 11 }}>
              (Needs 2+ active borrowers with mapped farms within 500m.)
            </Text>
          </View>
        ) : rings.map((r, i) => (
          <View key={i} style={[styles.card, { borderLeftColor: '#ff3b5c' }]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardKind}>SUSPECTED RING</Text>
              <Text style={styles.cardDist}>{Number(r.distance_km).toFixed(2)} km apart</Text>
            </View>
            <Text style={styles.cardTitle}>{r.email_a}</Text>
            <Text style={styles.cardTitle}>{r.email_b}</Text>
            <View style={styles.cardRow}>
              <View style={styles.cardStat}>
                <Text style={[styles.cardVal, { color: '#ff3b5c' }]}>{fmtM(r.combined_exposure)}</Text>
                <Text style={styles.cardMeta}>COMBINED EXPOSURE</Text>
              </View>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>
                  {Number(r.lat_a).toFixed(3)}, {Number(r.lng_a).toFixed(3)}
                </Text>
                <Text style={styles.cardMeta}>A GPS</Text>
              </View>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>
                  {Number(r.lat_b).toFixed(3)}, {Number(r.lng_b).toFixed(3)}
                </Text>
                <Text style={styles.cardMeta}>B GPS</Text>
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
  hero: { padding: 22, borderRadius: 20, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 38, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  heroMeta: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardKind: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: '#ff3b5c' },
  cardDist: { fontSize: 10, color: p.textMuted, fontWeight: '700' },
  cardTitle: { fontSize: 12, fontWeight: '800', color: p.text, marginBottom: 2 },
  cardRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 12, fontWeight: '900', color: p.text },
  cardMeta: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
