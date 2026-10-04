import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtM = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e9) return 'N' + (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};

export default function BoaRisk() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [risks, setRisks] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [filter, setFilter] = useState<'all' | 'disease_outbreak' | 'inactive_borrowers'>('all');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_risk_radar', { p_zone: null, p_days: 30 });
    if (!r.error) setRisks(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? risks : risks.filter((x) => x.kind === filter);

  const act = (kind: string) => {
    Alert.alert(
      'Broadcast to affected borrowers',
      'This will send an SMS + push notification to every affected borrower.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => Alert.alert('Queued', 'Broadcast queued for delivery.') },
      ],
    );
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Risk Radar</Text>
        <Text style={styles.sub}>Shocks ranked by portfolio exposure · last 30 days</Text>

        <View style={styles.chips}>
          {[
            { k: 'all', label: 'ALL' },
            { k: 'disease_outbreak', label: 'OUTBREAKS' },
            { k: 'inactive_borrowers', label: 'BEHAVIOR' },
          ].map((c) => (
            <Pressable
              key={c.k}
              onPress={() => setFilter(c.k as any)}
              style={[styles.chip, filter === c.k && styles.chipOn]}
            >
              <Text style={[styles.chipText, filter === c.k && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No shocks detected in this window.</Text>
          </View>
        ) : filtered.map((r, i) => {
          const sevColor = r.severity === 1 ? '#ff3b5c' : '#ffb300';
          return (
            <View key={i} style={[styles.card, { borderLeftColor: sevColor }]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardKind, { color: sevColor }]}>
                  {r.kind === 'disease_outbreak' ? 'DISEASE OUTBREAK' : 'BEHAVIOR SIGNAL'}
                </Text>
                <Text style={styles.cardRegion}>{r.region}</Text>
              </View>
              <Text style={styles.cardTitle}>{r.label}</Text>
              <View style={styles.cardRow}>
                <View style={styles.cardStat}>
                  <Text style={styles.cardVal}>{r.affected}</Text>
                  <Text style={styles.cardMeta}>BORROWERS</Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={[styles.cardVal, { color: sevColor }]}>{fmtM(r.exposure)}</Text>
                  <Text style={styles.cardMeta}>EXPOSURE</Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={styles.cardVal}>
                    {r.last_seen ? new Date(r.last_seen).toLocaleDateString() : '-'}
                  </Text>
                  <Text style={styles.cardMeta}>LAST SEEN</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => act(r.kind)} style={[styles.actionBtn, { borderColor: palette.neon }]}>
                  <Text style={[styles.actionTxt, { color: palette.neon }]}>SEND ALERT</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/boa-borrowers' as any)} style={[styles.actionBtn, { borderColor: palette.border }]}>
                  <Text style={[styles.actionTxt, { color: palette.text }]}>VIEW BORROWERS</Text>
                </Pressable>
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
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  chip: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  empty: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 12, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardKind: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  cardRegion: { fontSize: 10, fontWeight: '700', color: p.textMuted },
  cardTitle: { fontSize: 15, fontWeight: '800', color: p.text, marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 16, fontWeight: '900', color: p.text },
  cardMeta: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
