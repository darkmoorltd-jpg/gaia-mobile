import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtN = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString() : '-';

export default function BoaReceipts() {
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
    const r = await supabase.rpc('boa_list_receipts', { p_zone: null });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalTonnes = rows.reduce((s, r) => s + Number(r.quantity_tonnes || 0), 0);
  const totalValue = rows.reduce((s, r) => s + Number(r.estimated_value_naira || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Warehouse Receipts</Text>
        <Text style={styles.sub}>{rows.length} active · {totalTonnes.toFixed(1)} tonnes collateralized</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>TOTAL COLLATERAL VALUE</Text>
          <Text style={styles.heroVal}>{fmtN(totalValue)}</Text>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {rows.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No warehouse receipts registered yet.</Text>
          </View>
        ) : rows.map((r, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardCommodity}>{r.commodity}</Text>
              <Text style={styles.cardValue}>{fmtN(r.estimated_value_naira)}</Text>
            </View>
            <Text style={styles.cardWarehouse}>{r.warehouse_name}</Text>
            <Text style={styles.cardMeta}>{r.holder_email}</Text>
            <View style={styles.cardRow}>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>{Number(r.quantity_tonnes || 0).toFixed(2)} t</Text>
                <Text style={styles.cardLbl}>QUANTITY</Text>
              </View>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>{r.quality_grade || '-'}</Text>
                <Text style={styles.cardLbl}>GRADE</Text>
              </View>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>{fmtDate(r.issue_date)}</Text>
                <Text style={styles.cardLbl}>ISSUED</Text>
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
  hero: { padding: 22, borderRadius: 20, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', marginBottom: 20 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 34, fontWeight: '900', color: '#00ff88', letterSpacing: -1.2, marginTop: 4 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardCommodity: { fontSize: 15, fontWeight: '900', color: p.text },
  cardValue: { fontSize: 15, fontWeight: '900', color: '#00ff88' },
  cardWarehouse: { fontSize: 12, color: p.textMuted, marginBottom: 2 },
  cardMeta: { fontSize: 10, color: p.textDim, marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 13, fontWeight: '900', color: p.text },
  cardLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
