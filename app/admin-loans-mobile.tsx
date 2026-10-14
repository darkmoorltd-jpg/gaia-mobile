import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, Alert, TextInput, Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

const TABS = ['pending', 'approved', 'disbursed', 'overdue', 'repaid', 'all'];

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

  const approve = async (loan: any) => {
    setActionBusy(true);
    const { error } = await supabase.rpc('admin_approve_loan', { p_loan_id: loan.id });
    setActionBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Approved', `Loan #${loan.id} approved`);
    setSelected(null);
    load();
  };

  const disburse = async (loan: any) => {
    Alert.alert(
      'Disburse loan?',
      `${money(loan.loan_amount)} will be credited to ${loan.first_name} ${loan.last_name}'s wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'DISBURSE', onPress: async () => {
          setActionBusy(true);
          const { error } = await supabase.rpc('admin_disburse_loan', { p_loan_id: loan.id });
          setActionBusy(false);
          if (error) { Alert.alert('Failed', error.message); return; }
          Alert.alert('Disbursed', `${money(loan.loan_amount)} credited`);
          setSelected(null);
          load();
        }},
      ]
    );
  };

  const reject = async (loan: any) => {
    Alert.prompt(
      'Reject loan?',
      'Enter reason',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'REJECT', style: 'destructive', onPress: async (reason?: string) => {
          setActionBusy(true);
          const { error } = await supabase.rpc('admin_reject_loan', {
            p_loan_id: loan.id,
            p_reason: reason || 'No reason given',
          });
          setActionBusy(false);
          if (error) { Alert.alert('Failed', error.message); return; }
          Alert.alert('Rejected');
          setSelected(null);
          load();
        }},
      ]
    );
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Loan Management</Text>

        {/* KPIs */}
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

        {/* Tabs */}
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
          <Pressable key={i} onPress={() => setSelected(r)} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {r.first_name || ''} {r.last_name || ''} — {money(r.loan_amount)}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {r.purpose || '—'} · {r.tier || '—'} tier · {r.interest_rate}%/mo · {r.duration_months}mo
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {r.email} · {r.phone}
              </Text>
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

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.back}>CLOSE</Text>
              </Pressable>

              {selected ? (
                <>
                  <Text style={styles.title}>
                    {selected.first_name} {selected.last_name}
                  </Text>
                  <Text style={styles.sub}>{selected.email}</Text>

                  <Text style={styles.sectionLabel}>LOAN</Text>
                  <Row k="Ref" v={'#' + selected.id} styles={styles} />
                  <Row k="Amount" v={money(selected.loan_amount)} styles={styles} highlight />
                  <Row k="Outstanding" v={money(selected.outstanding_balance)} styles={styles} />
                  <Row k="Total repayable" v={money(selected.total_repayable)} styles={styles} />
                  <Row k="Monthly" v={money(selected.monthly_payment)} styles={styles} />
                  <Row k="Interest" v={selected.interest_rate + '% per month'} styles={styles} />
                  <Row k="Term" v={selected.duration_months + ' months'} styles={styles} />
                  <Row k="Tier" v={(selected.tier || '').toUpperCase()} styles={styles} />
                  <Row k="Trust score at apply" v={String(selected.trust_score_at_apply || 0)} styles={styles} />
                  <Row k="Status" v={(selected.status || '').toUpperCase()} styles={styles} />

                  <Text style={styles.sectionLabel}>BORROWER</Text>
                  <Row k="Phone" v={selected.phone || '—'} styles={styles} />
                  <Row k="State" v={selected.state || '—'} styles={styles} />
                  <Row k="Purpose" v={selected.purpose || '—'} styles={styles} />

                  <Text style={styles.sectionLabel}>TIMELINE</Text>
                  <Row k="Applied" v={fmt(selected.created_at)} styles={styles} />
                  <Row k="Approved" v={fmt(selected.approved_at)} styles={styles} />
                  <Row k="Disbursed" v={fmt(selected.disbursed_at)} styles={styles} />
                  <Row k="Due" v={fmt(selected.due_date)} styles={styles} />
                  <Row k="Days to due" v={selected.days_to_due !== null ? String(selected.days_to_due) : '—'} styles={styles} />

                  {selected.status === 'pending' ? (
                    <>
                      <Pressable
                        disabled={actionBusy}
                        onPress={() => approve(selected)}
                        style={[styles.actionBtn, { borderColor: palette.neon }]}
                      >
                        <Text style={[styles.actionTxt, { color: palette.neon }]}>APPROVE</Text>
                      </Pressable>
                      <Pressable
                        disabled={actionBusy}
                        onPress={() => reject(selected)}
                        style={[styles.actionBtn, { borderColor: palette.danger }]}
                      >
                        <Text style={[styles.actionTxt, { color: palette.danger }]}>REJECT</Text>
                      </Pressable>
                    </>
                  ) : null}

                  {selected.status === 'approved' ? (
                    <Pressable
                      disabled={actionBusy}
                      onPress={() => disburse(selected)}
                      style={[styles.actionBtn, { borderColor: '#ffb300' }]}
                    >
                      <Text style={[styles.actionTxt, { color: '#ffb300' }]}>DISBURSE FUNDS</Text>
                    </Pressable>
                  ) : null}

                  {selected.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL('tel:' + selected.phone)}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionTxt}>CALL BORROWER</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      setSelected(null);
                      router.push(('/loan-detail?id=' + selected.id) as any);
                    }}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionTxt}>VIEW FULL STATEMENT</Text>
                  </Pressable>

                  <View style={{ height: 40 }} />
                </>
              ) : null}
            </ScrollView>
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

function fmt(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return '—'; }
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
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1 },
  actionBtn: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', marginTop: 10 },
  actionTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
});
