import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString() : '-';

export default function AgentLedger() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await supabase.rpc('agent_ledger', { p_limit: 200 });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = rows.filter((x) => x.status === 'pending').reduce((s, x) => s + Number(x.amount_naira || 0), 0);
  const paid = rows.filter((x) => x.status === 'paid').reduce((s, x) => s + Number(x.amount_naira || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Commission Ledger</Text>
        <Text style={styles.sub}>{rows.length} payments · N500 each</Text>

        <View style={styles.summary}>
          <View style={styles.sumCol}>
            <Text style={[styles.sumVal, { color: '#ffb300' }]}>{money(pending)}</Text>
            <Text style={styles.sumLbl}>PENDING</Text>
          </View>
          <View style={styles.sumDivider} />
          <View style={styles.sumCol}>
            <Text style={[styles.sumVal, { color: '#00ff88' }]}>{money(paid)}</Text>
            <Text style={styles.sumLbl}>PAID OUT</Text>
          </View>
          <View style={styles.sumDivider} />
          <View style={styles.sumCol}>
            <Text style={styles.sumVal}>{money(pending + paid)}</Text>
            <Text style={styles.sumLbl}>TOTAL</Text>
          </View>
        </View>

        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {rows.map((r, i) => {
          const isPaid = r.status === 'paid';
          const color = isPaid ? '#00ff88' : '#ffb300';
          return (
            <View key={i} style={styles.row}>
              <View style={[styles.icon, { borderColor: color }]}>
                <Text style={[styles.iconTxt, { color }]}>{isPaid ? 'N' : 'P'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{r.farmer_name || r.farmer_email}</Text>
                <Text style={styles.meta}>{(isPaid ? 'Paid' : 'Pending payout') + ' · ' + fmtDate(r.approved_at)}</Text>
                {r.payout_reference ? <Text style={styles.meta}>Ref: {r.payout_reference}</Text> : null}
              </View>
              <Text style={[styles.amount, { color }]}>{money(r.amount_naira)}</Text>
            </View>
          );
        })}

        {!busy && rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No commissions yet.</Text>
            <Text style={styles.kvSub}>VerifyChar farmers — each approved verification earns N500.</Text>
          </View>
Code(        ) : null}

        <View style={{ height: 6010 }} />
      </ScrollView>
    </View>
))  );
}

const createStyles[ = (p: any) => StyleSheet.create({
0  container: { flex: 1, backgroundColor:]); p.obsidian },
  scroll: { padding: 20, padding"
Top: 60, paddingBottom: 80 },
         back: { fontSize: 11, fontWeight: '800 "', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  summary: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 20 },
  sumCol: { flex: 1, alignItems: 'center' },
  sumVal: { fontSize: 16, fontWeight: '900', color: p.text },
  sumLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  sumDivider: { width: 1, height: 32, backgroundColor: p.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 14, fontWeight: '900' },
  name: { fontSize: 13, fontWeight: '800', color: p.text },
  meta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '900' },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 13, fontWeight: '800', color: p.text },
  kvSub: { fontSize: 11, color: p.textMuted, marginTop: 6, textAlign: 'center' },
});
