import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, Alert, Linking, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmtDate = (s?: string) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return '—'; }
};

const TABS = ['pending', 'approved', 'disbursed', 'overdue', 'repaid', 'all'];
type DetailTab = 'loan' | 'borrower' | 'kyc' | 'wallet' | 'history' | 'repayments';

export default function AdminLoans() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState('pending');
  const [stats, setStats] = useState<any>({});
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('loan');
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [s, l] = await Promise.all([
      supabase.rpc('admin_loan_stats'),
      supabase.rpc('admin_list_loans', { p_status: tab }),
    ]);
    if (!s.error) setStats(s.data || {});
    if (!l.error) setRows(l.data || []);
    setBusy(false); setRef(false);
  }, [isAdmin, tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDetail = async (loan: any) => {
    setSelected(loan);
    setDetail(null);
    setDetailTab('loan');
    setDetailBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_loan_detail', { p_loan_id: Number(loan.id) });
      if (!error) setDetail(data);
    } catch {}
    setDetailBusy(false);
  };

  const refreshDetail = async () => {
    if (!selected) return;
    const { data } = await supabase.rpc('admin_loan_detail', { p_loan_id: Number(selected.id) });
    if (data) setDetail(data);
  };

  const approve = async () => {
    if (!selected) return;
    setActionBusy(true);
    const { error } = await supabase.rpc('admin_approve_loan', { p_loan_id: Number(selected.id) });
    setActionBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Approved');
    refreshDetail();
    load();
  };

  const disburse = async () => {
    if (!selected) return;
    Alert.alert('Disburse?', money(selected.loan_amount) + ' to borrower wallet', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'DISBURSE', onPress: async () => {
        setActionBusy(true);
        const { error } = await supabase.rpc('admin_disburse_loan', { p_loan_id: Number(selected.id) });
        setActionBusy(false);
        if (error) { Alert.alert('Failed', error.message); return; }
        Alert.alert('Disbursed');
        refreshDetail();
        load();
      }},
    ]);
  };

  const reject = async () => {
    if (!selected) return;
    Alert.prompt('Reject loan?', 'Reason', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'REJECT', style: 'destructive', onPress: async (reason?: string) => {
        setActionBusy(true);
        const { error } = await supabase.rpc('admin_reject_loan', {
          p_loan_id: Number(selected.id),
          p_reason: reason || 'Admin rejection',
        });
        setActionBusy(false);
        if (error) { Alert.alert('Failed', error.message); return; }
        Alert.alert('Rejected');
        setSelected(null);
        setDetail(null);
        load();
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const D = detail || {};
  const L = D.loan || selected || {};
  const P = D.profile || {};
  const A = D.auth || {};
  const W = D.wallet || {};
  const K = D.verification || {};
  const S = D.stats || {};

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Loan Management</Text>

        <View style={styles.kpiGrid}>
          <Kpi label="PENDING" value={stats.pending_count ?? 0} styles={styles} color={palette.warning} />
          <Kpi label="ACTIVE" value={stats.disbursed_count ?? 0} styles={styles} color={palette.neon} />
          <Kpi label="OVERDUE" value={stats.overdue_count ?? 0} styles={styles} color={palette.danger} />
          <Kpi label="REPAID" value={stats.repaid_count ?? 0} styles={styles} color="#4fc3f7" />
        </View>

        <View style={styles.moneyRow}>
          <View style={styles.moneyCard}>
            <Text style={styles.moneyLabel}>DISBURSED</Text>
            <Text style={styles.moneyVal}>{money(stats.total_disbursed)}</Text>
          </View>
          <View style={styles.moneyCard}>
            <Text style={styles.moneyLabel}>OUTSTANDING</Text>
            <Text style={[styles.moneyVal, { color: palette.warning }]}>{money(stats.total_outstanding)}</Text>
          </View>
          <View style={styles.moneyCard}>
            <Text style={styles.moneyLabel}>REPAID</Text>
            <Text style={[styles.moneyVal, { color: palette.neon }]}>{money(stats.total_repaid)}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}
        {rows.length === 0 && !busy ? <Text style={styles.empty}>No loans in "{tab}"</Text> : null}

        {rows.map((r, i) => (
          <Pressable key={i} onPress={() => openDetail(r)} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {r.first_name || ''} {r.last_name || ''} — {money(r.loan_amount)}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {r.purpose || '—'} · {r.tier || '—'} · {r.interest_rate}%/mo · {r.duration_months}mo
              </Text>
              <Text style={styles.meta} numberOfLines={1}>{r.email} · {r.phone}</Text>
              <View style={[styles.statusChip, { borderColor: statusColor(r.status, palette) }]}>
                <Text style={[styles.statusText, { color: statusColor(r.status, palette) }]}>
                  {(r.status || '').toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => { setSelected(null); setDetail(null); }}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => { setSelected(null); setDetail(null); }}>
              <Text style={styles.back}>CLOSE</Text>
            </Pressable>

            <Text style={styles.title} numberOfLines={1}>
              {P.first_name || selected?.first_name || '—'} {P.last_name || selected?.last_name || ''}
            </Text>
            <Text style={styles.sub}>{A.email || selected?.email || '—'}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.detailTabBar} contentContainerStyle={styles.detailTabBarInner}>
              {(['loan', 'borrower', 'kyc', 'wallet', 'history', 'repayments'] as DetailTab[]).map((t) => (
                <Pressable key={t} onPress={() => setDetailTab(t)} style={[styles.detailTab, detailTab === t && styles.detailTabOn]}>
                  <Text style={[styles.detailTabText, detailTab === t && styles.detailTabTextOn]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {detailBusy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

            <ScrollView style={{ maxHeight: '75%' }}>
              {/* ================= LOAN ================= */}
              {detailTab === 'loan' ? (
                <>
                  <Text style={styles.sectionLabel}>LOAN DETAILS</Text>
                  <Row k="Ref" v={'#' + (L.id || '—')} styles={styles} />
                  <Row k="Amount" v={money(L.loan_amount)} styles={styles} highlight />
                  <Row k="Outstanding" v={money(L.outstanding_balance)} styles={styles} />
                  <Row k="Total repayable" v={money(L.total_repayable)} styles={styles} />
                  <Row k="Monthly payment" v={money(L.monthly_payment)} styles={styles} />
                  <Row k="Interest rate" v={(L.interest_rate || 0) + '% per month'} styles={styles} />
                  <Row k="Duration" v={(L.duration_months || 0) + ' months'} styles={styles} />
                  <Row k="Tier" v={(L.tier || '').toUpperCase()} styles={styles} />
                  <Row k="Trust score at apply" v={String(L.trust_score_at_apply || 0)} styles={styles} />
                  <Row k="Purpose" v={L.purpose || '—'} styles={styles} />
                  {L.purpose_detail ? <Row k="Detail" v={L.purpose_detail} styles={styles} /> : null}
                  {L.farm_location ? <Row k="Farm location" v={L.farm_location} styles={styles} /> : null}
                  {L.crop ? <Row k="Crop" v={L.crop} styles={styles} /> : null}
                  <Row k="Status" v={(L.status || '').toUpperCase()} styles={styles} />

                  <Text style={styles.sectionLabel}>TIMELINE</Text>
                  <Row k="Applied" v={fmtDate(L.created_at)} styles={styles} />
                  <Row k="Approved" v={fmtDate(L.approved_at)} styles={styles} />
                  <Row k="Disbursed" v={fmtDate(L.disbursed_at)} styles={styles} />
                  <Row k="Due" v={fmtDate(L.due_date)} styles={styles} />
                  <Row k="Repaid" v={fmtDate(L.repaid_at)} styles={styles} />
                  {L.rejection_reason ? <Row k="Rejection" v={L.rejection_reason} styles={styles} /> : null}

                  <Text style={styles.sectionLabel}>BORROWER SNAPSHOT</Text>
                  <Row k="Total loans taken" v={String(S.total_loans || 0)} styles={styles} />
                  <Row k="Total borrowed" v={money(S.total_borrowed)} styles={styles} />
                  <Row k="Total repaid" v={money(S.total_repaid)} styles={styles} />
                  <Row k="Loans repaid" v={String(S.loans_repaid || 0)} styles={styles} />
                  <Row k="Loans defaulted" v={String(S.loans_defaulted || 0)} styles={styles} />
                </>
              ) : null}

              {/* ================= BORROWER ================= */}
              {detailTab === 'borrower' ? (
                <>
                  <Text style={styles.sectionLabel}>PERSONAL</Text>
                  <Row k="Full name" v={[P.first_name, P.middle_name, P.last_name].filter(Boolean).join(' ')} styles={styles} />
                  <Row k="Username" v={P.username || '—'} styles={styles} />
                  <Row k="Gender" v={P.gender || '—'} styles={styles} />
                  <Row k="Date of birth" v={P.date_of_birth || '—'} styles={styles} />
                  <Row k="Marital status" v={P.marital_status || '—'} styles={styles} />
                  <Row k="Phone" v={P.phone || '—'} styles={styles} />
                  <Row k="WhatsApp" v={P.whatsapp || '—'} styles={styles} />
                  <Row k="Preferred language" v={P.preferred_language || '—'} styles={styles} />

                  <Text style={styles.sectionLabel}>ADDRESS</Text>
                  <Row k="Country" v={P.country || '—'} styles={styles} />
                  <Row k="State" v={P.state || '—'} styles={styles} />
                  <Row k="LGA" v={P.lga || '—'} styles={styles} />
                  <Row k="City" v={P.city || '—'} styles={styles} />
                  <Row k="Street" v={P.street_address || '—'} styles={styles} />
                  <Row k="Landmark" v={P.landmark || '—'} styles={styles} />
                  <Row k="Postal code" v={P.postal_code || '—'} styles={styles} />

                  <Text style={styles.sectionLabel}>FARM</Text>
                  <Row k="Farm state" v={P.farm_state || '—'} styles={styles} />
                  <Row k="Farm LGA" v={P.farm_lga || '—'} styles={styles} />
                  <Row k="Farm address" v={P.farm_address || '—'} styles={styles} />
                  <Row k="Farm size" v={(P.farm_size_acres || 0) + ' acres'} styles={styles} />
                  <Row k="Farming type" v={P.farming_type || '—'} styles={styles} />
                  <Row k="Experience" v={(P.years_experience || 0) + ' years'} styles={styles} />
                  <Row k="Primary crops" v={P.primary_crops || '—'} styles={styles} />
                  <Row k="Secondary crops" v={P.secondary_crops || '—'} styles={styles} />

                  <Text style={styles.sectionLabel}>ACCOUNT</Text>
                  <Row k="Signup" v={fmtDate(A.created_at)} styles={styles} />
                  <Row k="Last sign-in" v={fmtDate(A.last_sign_in_at)} styles={styles} />
                  <Row k="Email confirmed" v={fmtDate(A.email_confirmed_at)} styles={styles} />
                  <Row k="Account status" v={P.account_status || '—'} styles={styles} />
                  <Row k="Banned until" v={P.banned_until ? fmtDate(P.banned_until) : 'no'} styles={styles} />
                  <Row k="Trust score" v={String(P.trust_score || 0)} styles={styles} />
                  <Row k="Risk score" v={String(P.risk_score || 0)} styles={styles} />
                </>
              ) : null}

              {/* ================= KYC ================= */}
              {detailTab === 'kyc' ? (
                <>
                  <Text style={styles.sectionLabel}>KYC STATUS</Text>
                  <Row k="Verification" v={(P.verification_status || 'pending').toUpperCase()} styles={styles} />
                  {K.status ? <Row k="Latest submission" v={K.status.toUpperCase()} styles={styles} /> : null}
                  <Row k="BVN" v={P.bvn || '—'} styles={styles} />
                  <Row k="NIN" v={P.nin || '—'} styles={styles} />
                  <Row k="ID type" v={P.govt_id_type || '—'} styles={styles} />
                  <Row k="ID number" v={P.govt_id_number || '—'} styles={styles} />

                  {K.full_name ? (
                    <>
                      <Text style={styles.sectionLabel}>SUBMITTED DETAILS</Text>
                      <Row k="Full name" v={K.full_name} styles={styles} />
                      <Row k="Phone" v={K.phone || '—'} styles={styles} />
                      <Row k="State" v={K.state || '—'} styles={styles} />
                      <Row k="LGA" v={K.lga || '—'} styles={styles} />
                      <Row k="Address" v={K.address || '—'} styles={styles} />
                      <Row k="Crops" v={K.crops || '—'} styles={styles} />
                      <Row k="Submitted" v={fmtDate(K.created_at)} styles={styles} />
                    </>
                  ) : null}

                  {(K.id_image_url || K.selfie_url) ? (
                    <>
                      <Text style={styles.sectionLabel}>DOCUMENTS</Text>
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
                          <Text style={styles.docLabel}>SELFIE</Text>
                          <Pressable onPress={() => Linking.openURL(K.selfie_url)}>
                            <Image source={{ uri: K.selfie_url }} style={styles.docImg} resizeMode="contain" />
                          </Pressable>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  <Text style={styles.sectionLabel}>BANK</Text>
                  <Row k="Bank" v={P.bank_name || '—'} styles={styles} />
                  <Row k="Account name" v={P.account_name || '—'} styles={styles} />
                  <Row k="Account number" v={P.account_number || '—'} styles={styles} />
                </>
              ) : null}

              {/* ================= WALLET ================= */}
              {detailTab === 'wallet' ? (
                <>
                  <Text style={styles.sectionLabel}>WALLET</Text>
                  <Row k="Balance" v={money(W.balance)} styles={styles} highlight />
                  <Row k="Virtual account" v={W.virtual_account || '—'} styles={styles} />
                  <Row k="Bank" v={W.account_bank || W.bank_name || '—'} styles={styles} />
                  <Row k="Account name" v={W.account_name || '—'} styles={styles} />
                  <Row k="Currency" v={W.currency || 'NGN'} styles={styles} />
                  <Row k="Created" v={fmtDate(W.created_at)} styles={styles} />

                  <Text style={styles.sectionLabel}>RECENT PAYMENTS ({(D.payments || []).length})</Text>
                  {(D.payments || []).length === 0 ? <Text style={styles.kvMuted}>No payments.</Text> :
                    (D.payments || []).slice(0, 15).map((p: any, i: number) => (
                      <View key={i} style={styles.subCard}>
                        <Text style={styles.subTitle}>{money(p.amount)} · {(p.plan || '').toUpperCase()}</Text>
                        <Text style={styles.subMeta}>+{p.scans_added} scans · ref {String(p.reference || '').slice(0, 20)}</Text>
                        <Text style={styles.subMeta}>{fmtDate(p.paid_at)}</Text>
                      </View>
                    ))
                  }
                </>
              ) : null}

              {/* ================= HISTORY ================= */}
              {detailTab === 'history' ? (
                <>
                  <Text style={styles.sectionLabel}>OTHER LOANS ({(D.other_loans || []).length})</Text>
                  {(D.other_loans || []).length === 0 ? <Text style={styles.kvMuted}>No other loans.</Text> :
                    (D.other_loans || []).map((l: any, i: number) => (
                      <View key={i} style={styles.subCard}>
                        <Text style={styles.subTitle}>#{l.id} — {money(l.loan_amount)}</Text>
                        <Text style={styles.subMeta}>{(l.status || '').toUpperCase()} · {(l.purpose || '').toUpperCase()} · {l.tier || ''}</Text>
                        <Text style={styles.subMeta}>Applied {fmtDate(l.created_at)}</Text>
                      </View>
                    ))
                  }

                  <Text style={styles.sectionLabel}>RECENT LOGINS ({(D.login_history || []).length})</Text>
                  {(D.login_history || []).length === 0 ? <Text style={styles.kvMuted}>No logins logged.</Text> :
                    (D.login_history || []).map((l: any, i: number) => (
                      <View key={i} style={styles.subCard}>
                        <Text style={styles.subMeta}>{l.platform} · {l.device_model || '—'}</Text>
                        <Text style={styles.subMeta}>{fmtDate(l.logged_at)}</Text>
                      </View>
                    ))
                  }
                </>
              ) : null}

              {/* ================= REPAYMENTS ================= */}
              {detailTab === 'repayments' ? (
                <>
                  <Text style={styles.sectionLabel}>REPAYMENTS ({(D.repayments || []).length})</Text>
                  {(D.repayments || []).length === 0 ? <Text style={styles.kvMuted}>No repayments yet.</Text> :
                    (D.repayments || []).map((r: any, i: number) => (
                      <View key={i} style={styles.subCard}>
                        <Text style={styles.subTitle}>{money(r.amount)}</Text>
                        <Text style={styles.subMeta}>{fmtDate(r.paid_at)}</Text>
                      </View>
                    ))
                  }
                </>
              ) : null}

              <View style={{ height: 40 }} />
            </ScrollView>

            {/* ACTIONS */}
            <View style={styles.actionsRow}>
              {L.status === 'pending' ? (
                <>
                  <Pressable disabled={actionBusy} onPress={approve} style={[styles.actionBtn, { borderColor: palette.neon }]}>
                    <Text style={[styles.actionTxt, { color: palette.neon }]}>APPROVE</Text>
                  </Pressable>
                  <Pressable disabled={actionBusy} onPress={reject} style={[styles.actionBtn, { borderColor: palette.danger }]}>
                    <Text style={[styles.actionTxt, { color: palette.danger }]}>REJECT</Text>
                  </Pressable>
                </>
              ) : L.status === 'approved' ? (
                <Pressable disabled={actionBusy} onPress={disburse} style={[styles.actionBtn, { borderColor: '#ffb300', flex: 1 }]}>
                  <Text style={[styles.actionTxt, { color: '#ffb300' }]}>DISBURSE FUNDS</Text>
                </Pressable>
              ) : null}
              {P.phone ? (
                <Pressable onPress={() => Linking.openURL('tel:' + P.phone)} style={[styles.actionBtn, { flex: 1 }]}>
                  <Text style={styles.actionTxt}>CALL</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function statusColor(s: string, p: any) {
  if (s === 'pending') return '#4fc3f7';
  if (s === 'approved') return '#ffb300';
  if (s === 'disbursed') return p.neon;
  if (s === 'overdue') return p.danger;
  if (s === 'repaid') return '#4caf50';
  if (s === 'rejected') return p.textDim;
  return p.textMuted;
}

function Kpi({ label, value, styles, color }: any) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiVal, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.kpiLbl}>{label}</Text>
    </View>
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
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  kpiGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  kpi: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 20, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 4 },
  moneyRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 16 },
  moneyCard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  moneyLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1, color: p.textMuted },
  moneyVal: { fontSize: 14, fontWeight: '900', color: p.text, marginTop: 4 },
  tabRow: { gap: 6, paddingRight: 12, paddingVertical: 4, marginBottom: 12 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  tabText: { fontSize: 10, fontWeight: '800', color: p.textDim, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  empty: { fontSize: 12, color: p.textMuted, textAlign: 'center', marginTop: 30 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  statusChip: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  chevron: { fontSize: 22, color: p.textDim },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '94%' },
  detailTabBar: { marginTop: 12, marginBottom: 8, maxHeight: 44 },
  detailTabBarInner: { gap: 6, paddingRight: 8 },
  detailTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  detailTabOn: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  detailTabText: { fontSize: 10, fontWeight: '700', color: p.textDim },
  detailTabTextOn: { color: p.neon },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1.4 },
  kvMuted: { fontSize: 12, color: p.textMuted },
  subCard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  subTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  subMeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  docBox: { marginTop: 10 },
  docLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  docImg: { width: '100%', height: 180, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.2)' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', flex: 1 },
  actionTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
});
