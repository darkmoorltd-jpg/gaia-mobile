import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import {
  walletStatement, fmtN, downloadStatementPDF, downloadStatementJPG, shareFile,
  type WalletTxn, type StatementRange,
} from '../src/utils/wallet';

type RangeKey = '7' | '30' | '90' | '180' | '365' | 'custom';

const RANGE_CHIPS: { k: RangeKey; label: string }[] = [
  { k: '7', label: '7D' },
  { k: '30', label: '30D' },
  { k: '90', label: '90D' },
  { k: '180', label: '6M' },
  { k: '365', label: '1Y' },
  { k: 'custom', label: 'CUSTOM' },
];

export default function WalletStatement() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'jpg' | null>(null);
  const [range, setRange] = useState<RangeKey>('90');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    const rows = await walletStatement(500);
    setTxns(rows);
    setBusy(false);
    setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const currentRange = (): StatementRange => {
    if (range === 'custom') {
      if (fromDate && toDate) {
        return { date_from: fromDate + 'T00:00:00', date_to: toDate + 'T23:59:59' };
      }
      return { days: 90 };
    }
    return { days: parseInt(range, 10) };
  };

  const onDownloadPDF = async () => {
    setDownloading('pdf');
    try {
      const uri = await downloadStatementPDF(currentRange());
      if (!uri) throw new Error('Download failed');
      await shareFile(uri, 'application/pdf', 'GAIA Wallet Statement');
    } catch (e: any) {
      Alert.alert('PDF failed', e?.message || 'Try again');
    } finally {
      setDownloading(null);
    }
  };

  const onDownloadJPG = async () => {
    setDownloading('jpg');
    try {
      const uri = await downloadStatementJPG(currentRange());
      if (!uri) throw new Error('Download failed');
      await shareFile(uri, 'image/jpeg', 'GAIA Wallet Summary');
    } catch (e: any) {
      Alert.alert('JPG failed', e?.message || 'Try again');
    } finally {
      setDownloading(null);
    }
  };

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
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
        keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Account Statement</Text>
        <Text style={styles.sub}>{txns.length} transactions in view</Text>

        <Text style={styles.label}>DATE RANGE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {RANGE_CHIPS.map((c) => (
            <Pressable key={c.k} onPress={() => setRange(c.k)} style={[styles.chip, range === c.k && styles.chipOn]}>
              <Text style={[styles.chipText, range === c.k && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {range === 'custom' ? (
          <View style={styles.customRow}>
            <View style={styles.customCol}>
              <Text style={styles.label}>FROM (YYYY-MM-DD)</Text>
              <TextInput
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="2026-01-01"
                placeholderTextColor={palette.textDim}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.customCol}>
              <Text style={styles.label}>TO (YYYY-MM-DD)</Text>
              <TextInput
                value={toDate}
                onChangeText={setToDate}
                placeholder="2026-12-31"
                placeholderTextColor={palette.textDim}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
          </View>
        ) : null}

        <View style={styles.exportRow}>
          <Pressable
            onPress={onDownloadPDF}
            disabled={downloading !== null || txns.length === 0}
            style={[styles.exportBtn, downloading !== null && { opacity: 0.5 }]}
          >
            {downloading === 'pdf' ? (
              <ActivityIndicator color={palette.obsidian} />
            ) : (
              <Text style={styles.exportBtnTxt}>EXPORT PDF</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onDownloadJPG}
            disabled={downloading !== null || txns.length === 0}
            style={[styles.exportBtn, { backgroundColor: '#4fc3f7' }, downloading !== null && { opacity: 0.5 }]}
          >
            {downloading === 'jpg' ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.exportBtnTxt}>SHARE JPG</Text>
            )}
          </Pressable>
        </View>

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
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 14, marginBottom: 8 },
  chipScroll: { gap: 6, paddingRight: 16, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 0.5 },
  chipTextOn: { color: p.neon },
  customRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  customCol: { flex: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13 },
  exportRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  exportBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  exportBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
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
