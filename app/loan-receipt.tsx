import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });

export default function LoanReceipt() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: d } = await supabase.rpc('loan_statement_data', { p_loan_id: Number(id) });
      setData(d);
      setBusy(false);
    })();
  }, [id]);

  const download = async () => {
    if (!data) return;
    const loan = data.loan || {};
    const profile = data.profile || {};
    const repayments = data.repayments || [];

    const lines = [
      '═══════════════════════════════════════',
      '          GAIA LOAN STATEMENT',
      '═══════════════════════════════════════',
      '',
      'Borrower:',
      `  ${profile.first_name || ''} ${profile.last_name || ''}`,
      `  ${profile.email || ''}`,
      `  ${profile.phone || ''}`,
      `  ${profile.state || ''}`,
      '',
      'Loan Details:',
      `  Reference:        #${loan.id}`,
      `  Principal:        ${money(loan.loan_amount)}`,
      `  Interest rate:    ${loan.interest_rate}% per month`,
      `  Duration:         ${loan.duration_months} months`,
      `  Total repayable:  ${money(loan.total_repayable)}`,
      `  Monthly payment:  ${money(loan.monthly_payment)}`,
      `  Outstanding:      ${money(loan.outstanding_balance)}`,
      `  Status:           ${(loan.status || '').toUpperCase()}`,
      '',
      'Dates:',
      `  Applied:          ${fmt(loan.created_at)}`,
      `  Approved:         ${fmt(loan.approved_at)}`,
      `  Disbursed:        ${fmt(loan.disbursed_at)}`,
      `  Due:              ${fmt(loan.due_date)}`,
      `  Repaid:           ${fmt(loan.repaid_at)}`,
      '',
      'Repayments:',
      ...repayments.map((r: any) => `  ${fmt(r.paid_at)}  ${money(r.amount)}`),
      '',
      `Generated: ${new Date().toISOString()}`,
      'GAIA — Powered by Darkmoor Ltd',
      '═══════════════════════════════════════',
    ];

    const text = lines.join('\n');
    const path = FileSystem.cacheDirectory + 'gaia-loan-' + loan.id + '.txt';
    await FileSystem.writeAsStringAsync(path, text);
    await Share.share({ message: text, url: path });
  };

  if (busy) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!data || !data.loan) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Receipt unavailable</Text>
        </ScrollView>
      </View>
    );
  }

  const loan = data.loan;
  const profile = data.profile || {};
  const repayments = data.repayments || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>STATEMENT</Text>
        <Text style={styles.title}>Loan #{loan.id}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>BORROWER</Text>
          <Text style={styles.kv}>{profile.first_name || ''} {profile.last_name || ''}</Text>
          <Text style={styles.kvMuted}>{profile.email || ''}</Text>
          <Text style={styles.kvMuted}>{profile.phone || ''} · {profile.state || ''}</Text>

          <Text style={styles.sectionLabel}>LOAN</Text>
          <Row k="Principal" v={money(loan.loan_amount)} styles={styles} />
          <Row k="Interest" v={loan.interest_rate + '% per month'} styles={styles} />
          <Row k="Duration" v={loan.duration_months + ' months'} styles={styles} />
          <Row k="Total repayable" v={money(loan.total_repayable)} styles={styles} highlight />
          <Row k="Monthly payment" v={money(loan.monthly_payment)} styles={styles} />
          <Row k="Outstanding" v={money(loan.outstanding_balance)} styles={styles} />
          <Row k="Status" v={(loan.status || '').toUpperCase()} styles={styles} />

          <Text style={styles.sectionLabel}>TIMELINE</Text>
          <Row k="Applied" v={fmt(loan.created_at)} styles={styles} />
          <Row k="Approved" v={fmt(loan.approved_at)} styles={styles} />
          <Row k="Disbursed" v={fmt(loan.disbursed_at)} styles={styles} />
          <Row k="Due" v={fmt(loan.due_date)} styles={styles} />
          <Row k="Repaid" v={fmt(loan.repaid_at)} styles={styles} />

          <Text style={styles.sectionLabel}>REPAYMENTS ({repayments.length})</Text>
          {repayments.length === 0 ? (
            <Text style={styles.kvMuted}>No repayments yet.</Text>
          ) : repayments.map((r: any, i: number) => (
            <View key={i} style={styles.repayRow}>
              <Text style={styles.repayAmount}>{money(r.amount)}</Text>
              <Text style={styles.repayDate}>{fmt(r.paid_at)}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={download} style={styles.cta}>
          <Text style={styles.ctaText}>SHARE STATEMENT</Text>
        </Pressable>

        <Text style={styles.footer}>GAIA · Powered by Darkmoor Ltd</Text>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function fmt(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return '—'; }
}

function Row({ k, v, styles, highlight }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={[styles.rowV, highlight && { color: '#00ff88', fontWeight: '900' }]}>{v}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4, marginBottom: 16 },
  card: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 16, marginBottom: 8 },
  kv: { fontSize: 15, color: p.text, fontWeight: '700' },
  kvMuted: { fontSize: 12, color: p.textMuted, marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1 },
  repayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  repayAmount: { fontSize: 13, color: p.neon, fontWeight: '800' },
  repayDate: { fontSize: 11, color: p.textMuted },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  footer: { fontSize: 10, color: p.textDim, textAlign: 'center', marginTop: 30, letterSpacing: 1 },
});
