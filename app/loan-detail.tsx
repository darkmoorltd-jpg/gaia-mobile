import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  RefreshControl, Image, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const money2 = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
const fmtDate = (s?: string) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return '—'; }
};

type Tab = 'loan' | 'schedule' | 'repayments' | 'kyc' | 'wallet' | 'history';

export default function LoanDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [D, setD] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [tab, setTab] = useState<Tab>('loan');
  const [repayAmount, setRepayAmount] = useState('');
  const [repaying, setRepaying] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('loan_my_detail', { p_loan_id: Number(id) });
      if (!error) setD(data);
    } catch {}
    setBusy(false); setRef(false);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  const repay = async (amount: number) => {
    if (!D || !D.loan) return;
    const L = D.loan;
    if (amount <= 0) { Alert.alert('Enter amount'); return; }
    if (amount > (L.outstanding_balance || 0)) {
      Alert.alert('Exceeds outstanding', 'You only owe ' + money(L.outstanding_balance));
      return;
    }
    const walletBal = D.wallet?.balance || 0;
    if (walletBal < amount) {
      Alert.alert('Insufficient wallet', 'Top up first. Balance: ' + money(walletBal));
      return;
    }
    Alert.alert('Confirm', 'Pay ' + money(amount) + ' from wallet?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'PAY', onPress: async () => {
        setRepaying(true);
        const { error } = await supabase.rpc('loan_repay', { p_loan_id: Number(L.id), p_amount: amount });
        setRepaying(false);
        if (error) { Alert.alert('Failed', error.message); return; }
        Alert.alert('Payment sent');
        setRepayAmount('');
        load();
      }},
    ]);
  };

  if (busy && !D) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!D || !D.loan) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Loan not found</Text>
          <Text style={styles.sub}>Refresh or go back to the Loans tab.</Text>
        </ScrollView>
      </View>
    );
  }

  const L = D.loan;
  const P = D.profile || {};
  const W = D.wallet || {};
  const S = D.stats || {};
  const K = D.kyc || null;
  const reps = D.repayments || [];
  const others = D.other_loans || [];
  const schedule = D.schedule || [];

  const repaid = (L.total_repayable || 0) - (L.outstanding_balance || 0);
  const pct = Math.max(0, Math.min(100, (repaid / (L.total_repayable || 1)) * 100));
  const statusColor =
    L.status === 'repaid' ? '#00ff88'
    : L.status === 'overdue' ? '#ff3b5c'
    : L.status === 'disbursed' ? '#ffb300'
    : L.status === 'approved' ? '#4fc3f7'
    : '#8899a6';

  const walletBal = W.balance || 0;

  const kycStatus = P.verification_status || (K && K.status) || 'pending';
  const kycStatusColor =
    kycStatus === 'approved' ? '#00ff88'
    : kycStatus === 'rejected' ? '#ff3b5c'
    : '#ffb300';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>LOAN</Text>
        <Text style={styles.title}>{money(L.loan_amount)}</Text>
        <View style={[styles.statusChip, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{(L.status || '').toUpperCase()}</Text>
        </View>

        <View style={styles.progressBox}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: pct + '%' }]} />
          </View>
          <Text style={styles.progressPct}>{pct.toFixed(0)}% repaid · {money(L.outstanding_balance)} outstanding</Text>
        </View>

        {/* Tabs — now includes KYC */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarInner}>
          {(['loan', 'schedule', 'repayments', 'kyc', 'wallet', 'history'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ============ LOAN ============ */}
        {tab === 'loan' ? (
          <>
            <Text style={styles.sectionLabel}>LOAN TERMS</Text>
            <Row k="Reference" v={'#' + L.id} styles={styles} />
            <Row k="Principal" v={money(L.loan_amount)} styles={styles} />
            <Row k="Interest rate" v={(L.interest_rate || 0) + '% per month'} styles={styles} />
            <Row k="Duration" v={(L.duration_months || 0) + ' months'} styles={styles} />
            <Row k="Total repayable" v={money(L.total_repayable)} styles={styles} highlight />
            <Row k="Monthly payment" v={money(L.monthly_payment)} styles={styles} />
            <Row k="Already paid" v={money(repaid)} styles={styles} />
            <Row k="Outstanding" v={money(L.outstanding_balance)} styles={styles} />
            <Row k="Tier" v={(L.tier || '').toUpperCase()} styles={styles} />
            <Row k="Purpose" v={L.purpose || '—'} styles={styles} />

            <Text style={styles.sectionLabel}>TIMELINE</Text>
            <Row k="Applied" v={fmtDate(L.created_at)} styles={styles} />
            <Row k="Approved" v={fmtDate(L.approved_at)} styles={styles} />
            <Row k="Disbursed" v={fmtDate(L.disbursed_at)} styles={styles} />
            <Row k="Due date" v={fmtDate(L.due_date)} styles={styles} />
            <Row k="Repaid on" v={fmtDate(L.repaid_at)} styles={styles} />

            {L.rejection_reason ? (
              <>
                <Text style={styles.sectionLabel}>REJECTION</Text>
                <Text style={styles.rejectBox}>{L.rejection_reason}</Text>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>YOUR LOAN STATS</Text>
            <Row k="Total loans" v={String(S.total_loans || 0)} styles={styles} />
            <Row k="Total borrowed" v={money(S.total_borrowed)} styles={styles} />
            <Row k="Total repaid" v={money(S.total_repaid)} styles={styles} />
            <Row k="Loans repaid" v={String(S.loans_repaid || 0)} styles={styles} />
          </>
        ) : null}

        {/* ============ SCHEDULE ============ */}
        {tab === 'schedule' ? (
          <>
            <Text style={styles.sectionLabel}>REPAYMENT SCHEDULE</Text>
            {schedule.length === 0 ? <Text style={styles.kvMuted}>Not yet disbursed.</Text> :
              schedule.map((s: any, i: number) => {
                const paid = i < Math.floor(repaid / (L.monthly_payment || 1));
                return (
                  <View key={i} style={[styles.schedRow, paid && styles.schedRowPaid]}>
                    <View style={[styles.schedDot, { backgroundColor: paid ? '#00ff88' : '#666' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.schedMonth}>Month {s.index}</Text>
                      <Text style={styles.schedDate}>Due {new Date(s.due_date).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.schedAmount, paid && { color: '#00ff88' }]}>{money(s.amount)}</Text>
                  </View>
                );
              })
            }
          </>
        ) : null}

        {/* ============ REPAYMENTS ============ */}
        {tab === 'repayments' ? (
          <>
            <Text style={styles.sectionLabel}>PAYMENT HISTORY ({reps.length})</Text>
            {reps.length === 0 ? <Text style={styles.kvMuted}>No repayments yet.</Text> :
              reps.map((r: any, i: number) => (
                <View key={i} style={styles.card2}>
                  <Text style={styles.card2Title}>{money2(r.amount)}</Text>
                  <Text style={styles.card2Meta}>{fmtDate(r.paid_at)}</Text>
                </View>
              ))
            }
          </>
        ) : null}

        {/* ============ KYC ============ */}
        {tab === 'kyc' ? (
          <>
            <Text style={styles.sectionLabel}>VERIFICATION STATUS</Text>
            <View style={[styles.kycStatus, { borderColor: kycStatusColor }]}>
              <Text style={[styles.kycStatusText, { color: kycStatusColor }]}>
                {kycStatus.toUpperCase()}
              </Text>
              <Text style={styles.kycStatusSub}>
                {kycStatus === 'approved' ? 'Verified. Full access.'
                  : kycStatus === 'rejected' ? 'Rejected — resubmit to unlock more.'
                  : 'Under review. Lenders see this status.'}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>IDENTITY</Text>
            <Row k="Full name" v={[P.first_name, P.middle_name, P.last_name].filter(Boolean).join(' ') || '—'} styles={styles} />
            <Row k="Username" v={P.username || '—'} styles={styles} />
            <Row k="Gender" v={P.gender || '—'} styles={styles} />
            <Row k="Date of birth" v={P.date_of_birth || '—'} styles={styles} />
            <Row k="Phone" v={P.phone || '—'} styles={styles} />
            <Row k="WhatsApp" v={P.whatsapp || '—'} styles={styles} />

            <Text style={styles.sectionLabel}>ADDRESS</Text>
            <Row k="Country" v={P.country || '—'} styles={styles} />
            <Row k="State" v={P.state || '—'} styles={styles} />
            <Row k="LGA" v={P.lga || '—'} styles={styles} />
            <Row k="City" v={P.city || '—'} styles={styles} />
            <Row k="Street" v={P.street_address || '—'} styles={styles} />

            <Text style={styles.sectionLabel}>FARM</Text>
            <Row k="Farm state" v={P.farm_state || '—'} styles={styles} />
            <Row k="Farm LGA" v={P.farm_lga || '—'} styles={styles} />
            <Row k="Farm size" v={(P.farm_size_acres || 0) + ' acres'} styles={styles} />
            <Row k="Primary crops" v={P.primary_crops || '—'} styles={styles} />
            <Row k="Farming type" v={P.farming_type || '—'} styles={styles} />

            <Text style={styles.sectionLabel}>KYC NUMBERS</Text>
            <Row k="BVN" v={P.bvn || '—'} styles={styles} />
            <Row k="NIN" v={P.nin || '—'} styles={styles} />
            <Row k="ID type" v={P.govt_id_type || '—'} styles={styles} />
            <Row k="ID number" v={P.govt_id_number || '—'} styles={styles} />

            {K ? (
              <>
                <Text style={styles.sectionLabel}>SUBMISSION</Text>
                <Row k="Submitted name" v={K.full_name || '—'} styles={styles} />
                <Row k="Status" v={(K.status || '').toUpperCase()} styles={styles} />
                <Row k="Payment" v={(K.payment_status || '').toUpperCase()} styles={styles} />
                <Row k="Submitted at" v={fmtDate(K.created_at)} styles={styles} />

                {K.id_image_url ? (
                  <View style={styles.docBox}>
                    <Text style={styles.docLabel}>ID IMAGE</Text>
                    <Pressable onPress={() => Linking.openURL(K.id_image_url)}>
                      <Image source={{ uri: K.id_image_url }} style={styles.docImg} resizeMode="contain" />
                    </Pressable>
                  </View>
                ) : null}
                {K.selfie_url ? (
                  <View style={styles.docBox}>
                    <Text style={styles.docLabel}>SELFIE WITH ID</Text>
                    <Pressable onPress={() => Linking.openURL(K.selfie_url)}>
                      <Image source={{ uri: K.selfie_url }} style={styles.docImg} resizeMode="contain" />
                    </Pressable>
                  </View>
                ) : null}
                {K.rejection_reason ? (
                  <Text style={styles.rejectBox}>Rejection: {K.rejection_reason}</Text>
                ) : null}
              </>
            ) : null}

            <Text style={styles.sectionLabel}>PAYOUT ACCOUNT</Text>
            <Row k="Bank" v={P.bank_name || '—'} styles={styles} />
            <Row k="Account #" v={P.account_number || '—'} styles={styles} />
            <Row k="Account name" v={P.account_name || '—'} styles={styles} />

            {kycStatus !== 'approved' ? (
              <Pressable onPress={() => router.push('/verification' as any)} style={styles.cta}>
                <Text style={styles.ctaText}>COMPLETE VERIFICATION</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {/* ============ WALLET ============ */}
        {tab === 'wallet' ? (
          <>
            <Text style={styles.sectionLabel}>WALLET</Text>
            <View style={styles.walletHero}>
              <Text style={styles.walletLbl}>AVAILABLE BALANCE</Text>
              <Text style={styles.walletAmt}>{money(walletBal)}</Text>
              <Text style={styles.walletSub}>{W.virtual_account || 'no virtual account'}</Text>
            </View>

            <Text style={styles.sectionLabel}>PAYOUT ACCOUNT</Text>
            <Row k="Bank" v={W.account_bank || W.bank_name || P.bank_name || '—'} styles={styles} />
            <Row k="Account #" v={P.account_number || '—'} styles={styles} />
            <Row k="Account name" v={W.account_name || P.account_name || '—'} styles={styles} />

            <Pressable onPress={() => router.push('/wallet' as any)} style={styles.ctaGhost}>
              <Text style={styles.ctaGhostText}>OPEN WALLET</Text>
            </Pressable>
          </>
        ) : null}

        {/* ============ HISTORY ============ */}
        {tab === 'history' ? (
          <>
            <Text style={styles.sectionLabel}>OTHER LOANS ({others.length})</Text>
            {others.length === 0 ? <Text style={styles.kvMuted}>No other loans.</Text> :
              others.map((ol: any, i: number) => (
                <Pressable key={i} onPress={() => router.replace(('/loan-detail?id=' + ol.id) as any)} style={styles.card2}>
                  <Text style={styles.card2Title}>#{ol.id} — {money(ol.loan_amount)}</Text>
                  <Text style={styles.card2Meta}>{(ol.status || '').toUpperCase()} · {(ol.purpose || '').toUpperCase()} · {ol.tier || ''}</Text>
                  <Text style={styles.card2Meta}>Outstanding {money(ol.outstanding_balance)}</Text>
                  <Text style={styles.card2Meta}>{fmtDate(ol.created_at)}</Text>
                </Pressable>
              ))
            }
          </>
        ) : null}

        {/* ============ REPAY UI ============ */}
        {(L.status === 'disbursed' || L.status === 'overdue') ? (
          <>
            <Text style={styles.sectionLabel}>MAKE A REPAYMENT</Text>
            <Text style={styles.walletInfo}>Wallet: {money(walletBal)} · Outstanding: {money(L.outstanding_balance)}</Text>
            <TextInput
              value={repayAmount}
              onChangeText={setRepayAmount}
              keyboardType="number-pad"
              placeholder="Amount to pay"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />
            <View style={styles.quickRow}>
              <Pressable onPress={() => setRepayAmount(String(Math.ceil(L.monthly_payment || 0)))} style={styles.quickBtn}>
                <Text style={styles.quickText}>1 month</Text>
              </Pressable>
              <Pressable onPress={() => setRepayAmount(String(Math.ceil((L.outstanding_balance || 0) / 2)))} style={styles.quickBtn}>
                <Text style={styles.quickText}>Half</Text>
              </Pressable>
              <Pressable onPress={() => setRepayAmount(String(L.outstanding_balance || 0))} style={styles.quickBtn}>
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

        <Pressable
          onPress={() => router.push(('/loan-receipt?id=' + L.id) as any)}
          style={styles.ctaGhost}
        >
          <Text style={styles.ctaGhostText}>VIEW STATEMENT</Text>
        </Pressable>

        <View style={{ height: 100 }} />
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
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6 },
  statusChip: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  progressBox: { marginTop: 20 },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 },
  progressFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 4 },
  progressPct: { fontSize: 11, color: p.textMuted, marginTop: 8, fontWeight: '800', letterSpacing: 0.5 },
  tabBar: { marginTop: 20, marginBottom: 4, maxHeight: 44 },
  tabBarInner: { gap: 6, paddingRight: 8 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  tabText: { fontSize: 10, fontWeight: '700', color: p.textDim },
  tabTextOn: { color: p.neon },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 22, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1.4 },
  kvMuted: { fontSize: 12, color: p.textMuted, fontStyle: 'italic' },
  rejectBox: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,59,92,0.1)', borderLeftWidth: 3, borderLeftColor: '#ff3b5c', fontSize: 12, color: p.text, lineHeight: 18, marginTop: 8 },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  schedRowPaid: { borderColor: 'rgba(0,255,136,0.3)' },
  schedDot: { width: 10, height: 10, borderRadius: 5 },
  schedMonth: { fontSize: 13, fontWeight: '700', color: p.text },
  schedDate: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  schedAmount: { fontSize: 13, fontWeight: '800', color: p.text },
  card2: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  card2Title: { fontSize: 14, fontWeight: '800', color: p.text },
  card2Meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  kycStatus: { padding: 16, borderRadius: 14, borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', marginBottom: 8 },
  kycStatusText: { fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  kycStatusSub: { fontSize: 11, color: p.textMuted, marginTop: 6, textAlign: 'center' },
  docBox: { marginTop: 12 },
  docLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  docImg: { width: '100%', height: 200, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.2)' },
  walletHero: { padding: 20, borderRadius: 16, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', alignItems: 'center', marginBottom: 12 },
  walletLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted },
  walletAmt: { fontSize: 32, fontWeight: '900', color: p.neon, letterSpacing: -1, marginTop: 6 },
  walletSub: { fontSize: 11, color: p.textMuted, marginTop: 4, fontFamily: 'monospace' },
  walletInfo: { fontSize: 12, color: p.textMuted, marginBottom: 10 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  quickText: { fontSize: 11, fontWeight: '800', color: p.text },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  ctaGhost: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', marginTop: 12 },
  ctaGhostText: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
});
