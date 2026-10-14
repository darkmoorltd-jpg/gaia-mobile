import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function LoanDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [loan, setLoan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [repayAmount, setRepayAmount] = useState('');
  const [repaying, setRepaying] = useState(false);

  const load = async () => {
    if (!id || !user) return;
    setBusy(true);
    try {
      const [l, p, w] = await Promise.all([
        supabase.from('loan_applications').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
        supabase.from('loan_repayments').select('*').eq('loan_id', id).order('paid_at', { ascending: false }),
        supabase.from('farmer_wallets').select('balance').eq('user_id', user.id).maybeSingle(),
      ]);
      if (l.data) setLoan(l.data);
      if (p.data) setPayments(p.data);
      if (w.data) setWallet(w.data);
    } catch {}
    setBusy(false);
  };

  useEffect(() => { load(); }, [id, user?.id]);

  const repay = async (amount: number) => {
    if (!loan) return;
    if (amount <= 0) { Alert.alert('Enter amount'); return; }
    if (amount > (loan.outstanding_balance || 0)) {
      Alert.alert('Exceeds outstanding', 'You only owe ' + money(loan.outstanding_balance));
      return;
    }
    if (!wallet || wallet.balance < amount) {
      Alert.alert('Insufficient wallet', 'Top up your wallet first. Balance: ' + money(wallet?.balance || 0));
      return;
    }
    Alert.alert(
      'Confirm repayment',
      'Pay ' + money(amount) + ' from your wallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'PAY', onPress: async () => {
          setRepaying(true);
          try {
            const r = await supabase.rpc('loan_repay', { p_loan_id: Number(loan.id), p_amount: amount });
            if (r.error) throw new Error(r.error.message);
            Alert.alert('Payment sent', 'Outstanding: ' + money(r.data.outstanding));
            setRepayAmount('');
            await load();
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          } finally {
            setRepaying(false);
          }
        }},
      ]
    );
  };

  if (busy) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Loan not found</Text>
        </ScrollView>
      </View>
    );
  }

  const repaid = (loan.total_repayable || 0) - (loan.outstanding_balance || 0);
  const pct = Math.max(0, Math.min(100, ((repaid) / (loan.total_repayable || 1)) * 100));
  const statusColor =
    loan.status === 'repaid' ? '#00ff88'
    : loan.status === 'overdue' ? '#ff3b5c'
    : loan.status === 'disbursed' ? '#ffb300'
    : '#4fc3f7';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>LOAN</Text>
        <Text style={styles.title}>{money(loan.loan_amount)}</Text>
        <View style={[styles.statusChip, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{(loan.status || '').toUpperCase()}</Text>
        </View>

        <View style={styles.progressBox}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: pct + '%' }]} />
          </View>
          <Text style={styles.progressPct}>{pct.toFixed(0)}% repaid</Text>
        </View>

        <View style={styles.summary}>
          <Row k="Principal" v={money(loan.loan_amount)} styles={styles} />
          <Row k="Total repayable" v={money(loan.total_repayable)} styles={styles} />
          <Row k="Already paid" v={money(repaid)} styles={styles} />
          <Row k="Outstanding" v={money(loan.outstanding_balance)} styles={styles} highlight />
          <Row k="Interest rate" v={loan.interest_rate + '% per month'} styles={styles} />
          <Row k="Monthly payment" v={money(loan.monthly_payment)} styles={styles} />
          <Row k="Term" v={loan.duration_months + ' months'} styles={styles} />
          <Row k="Due date" v={loan.due_date ? new Date(loan.due_date).toLocaleDateString() : '—'} styles={styles} />
          <Row k="Disbursed" v={loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : 'Pending'} styles={styles} />
        </View>

        {(loan.status === 'disbursed' || loan.status === 'overdue') ? (
          <>
            <Text style={styles.sectionLabel}>MAKE A REPAYMENT</Text>
            <Text style={styles.walletInfo}>Wallet balance: {money(wallet?.balance || 0)}</Text>
            <TextInput
              value={repayAmount}
              onChangeText={setRepayAmount}
              keyboardType="number-pad"
              placeholder="Amount to pay"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />
            <View style={styles.quickRow}>
              <Pressable onPress={() => setRepayAmount(String(Math.ceil((loan.monthly_payment || 0))))} style={styles.quickBtn}>
                <Text style={styles.quickText}>1 month</Text>
              </Pressable>
              <Pressable onPress={() => setRepayAmount(String(Math.ceil((loan.outstanding_balance || 0) / 2)))} style={styles.quickBtn}>
                <Text style={styles.quickText}>Half</Text>
              </Pressable>
              <Pressable onPress={() => setRepayAmount(String(loan.outstanding_balance || 0))} style={styles.quickBtn}>
                <Text style={styles.quickText}>Full</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => repay(parseFloat(repayAmount) || 0)}
              disabled={repaying}
              style={[styles.cta, repaying && { opacity: 0.5 }]}
            >
              {repaying ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>REPAY NOW</Text>}
            </Pressable>
          </>
        ) : null}

        {payments.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>REPAYMENT HISTORY</Text>
            {payments.map((p, i) => (
              <View key={i} style={styles.payRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payAmount}>{money(p.amount)}</Text>
                  <Text style={styles.payMeta}>{new Date(p.paid_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.payCheck}>✓</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 100 }} />

        <Pressable onPress={() => router.push(('/loan-receipt?id=' + loan.id) as any)} style={styles.cta}>
          <Text style={styles.ctaText}>VIEW STATEMENT</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
  title: { fontSize: 34, fontWeight: '900', color: p.text, letterSpacing: -1.5, marginTop: 4 },
  statusChip: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  progressBox: { marginTop: 24 },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 },
  progressFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 4 },
  progressPct: { fontSize: 11, color: p.textMuted, marginTop: 8, fontWeight: '800', letterSpacing: 1 },
  summary: { marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 26, marginBottom: 10 },
  walletInfo: { fontSize: 12, color: p.textMuted, marginBottom: 10 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  quickText: { fontSize: 11, fontWeight: '800', color: p.text },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  payRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  payAmount: { fontSize: 14, fontWeight: '800', color: p.text },
  payMeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  payCheck: { fontSize: 20, color: p.neon, fontWeight: '900' },
});
