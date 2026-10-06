import { useState } from 'react';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { walletStatement, fmtN, relTime, type WalletTxn } from '../src/utils/wallet';

export default function WalletStatement() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const rows = await walletStatement(200);
    setTxns(rows);
    setBusy(false);
    setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalIn = txns.filter((t) => t.direction === 'in' && t.status === 'success').reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalOut = txns.filter((t) => t.direction === 'out' && t.status === 'success').reduce((s, t) => s + Number(t.amount || 0), 0);

  const statColor = (s: string) => {
    if (s === 'success') return '#00ff88';
    if (s === 'processing' || s === 'pending') return '#ffb300';
    if (s === 'failed') return '#ff3b5c';
    if (s === 'refunded') return '#4fc3f7';
    return '#8899a6';
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Account Statement</Text>
        <Text style={styles.sub}>{txns.length} transactions</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLbl}>MONEY IN</Text>
            <Text style={[styles.summaryVal, { color: '#00ff88' }]}>{fmtN(totalIn, 2)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLbl}>MONEY OUT</Text>
            <Text style={[styles.summaryVal, { color: '#ff3b5c' }]}>{fmtN(totalOut, 2)}</Text>
          </View>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}
        {!busy && txns.length === 0 ? <Text style={styles.empty}>No transactions yet.</Text> : null}

        {txns.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(('/wallet-receipt?ref=' + t.reference) as any)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {t.type === 'deposit' ? 'Wallet top up' :
                 t.type === 'withdrawal' ? ('To ' + (t.counterparty_name || 'Bank')) :
                 t.type === 'p2p_send' ? ('Sent to ' + (t.counterparty_name || 'GAIA user')) :
                 t.type === 'p2p_receive' ? ('Received from ' + (t.counterparty_name || 'GAIA user')) :
                 t.type === 'scan_purchase' ? (t.counterparty_name || 'Scan purchase') :
                 t.type.toUpperCase()}
              </Text>
              <Text style={styles.rowMeta}>{new Date(t.created_at).toLocaleString()}</Text>
              <Text style={styles.rowMeta}>RCP: {t.reference.slice(0, 24)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.rowAmt, { color: t.direction === 'in' ? '#00ff88' : '#8899a6' }]}>
                {(t.direction === 'in' ? '+' : '-') + fmtN(t.amount, 2)}
              </Text>
              <Text style={[styles.rowStatus, { color: statColor(t.status) }]}>{t.status.toUpperCase()}</Text>
            </View>
          </Pressable>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  summaryLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted },
  summaryVal: { fontSize: 18, fontWeight: '900', marginTop: 6 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  rowMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  rowAmt: { fontSize: 15, fontWeight: '900' },
  rowStatus: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
});
