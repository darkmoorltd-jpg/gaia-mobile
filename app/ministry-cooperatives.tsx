import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
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
const num = (n: any) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function MinistryCooperatives() {
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
    const r = await supabase.rpc('ministry_cooperative_network', {});
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Cooperative Network</Text>
        <Text style={styles.sub}>National cooperative registry</Text>

        <View style={styles.heroRow}>
          <View style={styles.heroCard}>
            <Text style={styles.heroVal}>{num(data?.total_coops)}</Text>
            <Text style={styles.heroLbl}>GROUPS</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#00ff88' }]}>{num(data?.total_members)}</Text>
            <Text style={styles.heroLbl}>MEMBERS</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={[styles.heroVal, { color: '#ffb300' }]}>{fmtM(data?.total_book)}</Text>
            <Text style={styles.heroLbl}>BOOK</Text>
          </View>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>BY STATE</Text>
        {(data?.by_state || []).length === 0 ? <Text style={styles.kv}>No cooperatives registered.</Text> :
          (data?.by_state || []).map((s: any, i: number) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{s.state}</Text>
              <Text style={styles.rowMeta}>{s.coops} groups · {s.members} members</Text>
              <Text style={styles.rowValue}>{fmtM(s.book)}</Text>
            </View>
          ))}

        <Text style={styles.sectionLabel}>COOPERATIVES ({Math.min(50, (data?.cooperatives || []).length)})</Text>
        {(data?.cooperatives || []).length === 0 ? <Text style={styles.kv}>No cooperatives yet.</Text> :
          (data?.cooperatives || []).map((c: any, i: number) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.cardMembers}>{c.members}</Text>
              </View>
              <Text style={styles.cardMeta}>{c.state || '-'}{c.lga ? ' · ' + c.lga : ''}{c.zone ? ' · ' + c.zone : ''}</Text>
              <View style={styles.cardRow}>
                <View style={styles.cardStat}>
                  <Text style={styles.cardVal}>{fmtM(c.book)}</Text>
                  <Text style={styles.cardLbl}>BOOK</Text>
                </View>
                <View style={styles.cardStat}>
                  <Text style={[styles.cardVal, { color: palette.warning }]}>{fmtM(c.outstanding)}</Text>
                  <Text style={styles.cardLbl}>OUTSTANDING</Text>
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
  heroRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  heroCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  heroVal: { fontSize: 18, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  heroLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 12, color: p.textMuted },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { fontSize: 13, fontWeight: '800', color: p.text },
  rowMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  rowValue: { fontSize: 15, fontWeight: '900', color: '#00ff88', position: 'absolute', right: 0, top: 10 },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardName: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1, marginRight: 8 },
  cardMembers: { fontSize: 13, fontWeight: '900', color: '#00ff88' },
  cardMeta: { fontSize: 11, color: p.textMuted, marginBottom: 10 },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 14, fontWeight: '900', color: p.text },
  cardLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
