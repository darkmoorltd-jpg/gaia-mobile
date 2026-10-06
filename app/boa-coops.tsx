import React, { useCallback, useEffect, useState } from 'react';
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

export default function BoaCoops() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_list_coops', { p_zone: null });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalBook = rows.reduce((s, r) => s + Number(r.book || 0), 0);
  const totalMembers = rows.reduce((s, r) => s + Number(r.actual_members || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Cooperatives</Text>
        <Text style={styles.sub}>{rows.length} groups · {totalMembers} members · {fmtM(totalBook)} book</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {rows.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No cooperatives registered yet.</Text>
            <Text style={styles.kv} style={{ marginTop: 6, fontSize: 11 }}>
              Add rows to boa_cooperatives + boa_coop_members to see groups here.
            </Text>
          </View>
        ) : rows.map((c, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.cardCount}>{c.actual_members} members</Text>
            </View>
            <Text style={styles.cardMeta}>{c.state || '-'}{c.lga ? ' · ' + c.lga : ''}{c.zone ? ' · ' + c.zone : ''}</Text>
            <View style={styles.cardRow}>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>{fmtM(c.book)}</Text>
                <Text style={styles.cardLbl}>TOTAL BOOK</Text>
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
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: p.text, flex: 1, marginRight: 8 },
  cardCount: { fontSize: 11, fontWeight: '800', color: '#00ff88' },
  cardMeta: { fontSize: 11, color: p.textMuted, marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 16, fontWeight: '900', color: p.text, letterSpacing: -0.3 },
  cardLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
