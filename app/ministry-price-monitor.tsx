import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtN = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function MinistryPriceMonitor() {
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
    const r = await supabase.rpc('ministry_price_monitor', {});
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const spikes = data?.spikes || [];
  const crashes = data?.crashes || [];
  const byCrop = data?.by_crop || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Price Monitor</Text>
        <Text style={styles.sub}>{data?.total_listings || 0} active listings · 30d vs prior 30d</Text>

        {(spikes.length > 0 || crashes.length > 0) ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>ALERTS</Text>
            {spikes.map((s: any, i: number) => (
              <View key={'s'+i} style={styles.alertRow}>
                <Text style={styles.alertIcon}>▲</Text>
                <Text style={styles.alertText}>{s.crop} +{Number(s.change_pct).toFixed(1)}% · {fmtN(s.avg_price)}</Text>
              </View>
            ))}
            {crashes.map((c: any, i: number) => (
              <View key={'c'+i} style={styles.alertRow}>
                <Text style={[styles.alertIcon, { color: '#ff3b5c' }]}>▼</Text>
                <Text style={styles.alertText}>{c.crop} {Number(c.change_pct).toFixed(1)}% · {fmtN(c.avg_price)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>AVERAGE PRICES BY CROP</Text>
        {byCrop.length === 0 ? <Text style={styles.kv}>No price data.</Text> :
          byCrop.map((c: any, i: number) => {
            const chg = Number(c.change_pct || 0);
            const col = chg > 5 ? '#ff3b5c' : chg < -5 ? '#00ff88' : palette.textMuted;
            return (
              <View key={i} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardCrop}>{c.crop}</Text>
                  <Text style={styles.cardPrice}>{fmtN(c.avg_price)}</Text>
                </View>
                <View style={styles.cardRow}>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{c.listings} listings</Text>
                    <Text style={styles.cardLbl}>ACTIVE</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={[styles.cardVal, { color: col }]}>
                      {chg > 0 ? '+' : ''}{chg.toFixed(1)}%
                    </Text>
                    <Text style={styles.cardLbl}>30D CHANGE</Text>
                  </View>
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
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  alertBox: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,59,92,0.06)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)', marginBottom: 16 },
  alertTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#ff3b5c', marginBottom: 8 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  alertIcon: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  alertText: { fontSize: 12, fontWeight: '700', color: p.text },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 12, marginBottom: 8 },
  kv: { fontSize: 12, color: p.textMuted },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardCrop: { fontSize: 14, fontWeight: '900', color: p.text },
  cardPrice: { fontSize: 15, fontWeight: '900', color: '#00ff88' },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 13, fontWeight: '900', color: p.text },
  cardLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
