import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmt = (s?: string) => s ? new Date(s).toLocaleString() : '—';

export default function ProviderWallet() {
  const { palette } = useTheme();
  const s = createStyles(palette);

  const [w, setW] = useState<any>({ balance: 0, total_earned: 0, total_withdrawn: 0, transactions: [] });
  const [profile, setProfile] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [modal, setModal] = useState(false);
  const [amt, setAmt] = useState('');
  const [bank, setBank] = useState('');
  const [acct, setAcct] = useState('');
  const [name, setName] = useState('');
  const [wBusy, setWBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [a, p] = await Promise.all([
        supabase.rpc('provider_wallet_get'),
        supabase.from('input_providers')
          .select('bank_name, bank_account_number, bank_account_name')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle(),
      ]);
      if (!a.error && a.data) setW(a.data);
      if (!p.error && p.data) {
        setProfile(p.data);
        if (p.data.bank_name) setBank(p.data.bank_name);
        if (p.data.bank_account_number) setAcct(p.data.bank_account_number);
        if (p.data.bank_account_name) setName(p.data.bank_account_name);
      }
    } catch {}
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    const a = parseFloat(amt);
    if (!a || a < 1000) { Alert.alert('Minimum withdrawal is ₦1,000'); return; }
    if (a > Number(w.balance)) { Alert.alert('Insufficient', 'You only have ' + money(w.balance)); return; }
    if (!bank || !acct || !name) { Alert.alert('Fill all bank details'); return; }
    setWBusy(true);
    const { data, error } = await supabase.rpc('provider_request_withdrawal', {
      p_amount: a, p_bank_name: bank, p_account_number: acct, p_account_name: name,
    });
    setWBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    if (data && data.ok === false) { Alert.alert('Failed', data.error || 'Try again'); return; }
    Alert.alert('Withdrawal requested', 'Admin will process in 1-3 business days');
    setModal(false); setAmt('');
    load();
  };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Text style={s.kicker}>PROVIDER WALLET</Text>
        <Text style={s.title}>Earnings</Text>

        <LinearGradient colors={['#7c4dff', '#b388ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
          <Text style={s.balLabel}>AVAILABLE BALANCE</Text>
          <Text style={s.balVal}>{money(w.balance)}</Text>
          <View style={s.balRow}>
            <View style={s.balCol}><Text style={s.balColVal}>{money(w.total_earned)}</Text><Text style={s.balColLbl}>EARNED</Text></View>
            <View style={s.balDiv} />
            <View style={s.balCol}><Text style={s.balColVal}>{money(w.total_withdrawn)}</Text><Text style={s.balColLbl}>WITHDRAWN</Text></View>
          </View>
        </LinearGradient>

        <Pressable onPress={() => setModal(true)} style={s.bigBtn}>
          <Text style={s.bigBtnTitle}>WITHDRAW TO BANK</Text>
          <Text style={s.bigBtnSub}>Min ₦1,000 · 1-3 business days</Text>
        </Pressable>

        <Text style={s.section}>TRANSACTIONS</Text>
        {busy && w.transactions.length === 0 ? <ActivityIndicator color="#b388ff" /> : null}
        {!busy && w.transactions.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyText}>No transactions yet. Each delivered order credits your wallet.</Text></View>
        ) : null}

        {(w.transactions || []).map((t: any, i: number) => {
          const pos = Number(t.amount) > 0;
          const c = pos ? '#00ff88' : '#ffb300';
          return (
            <View key={i} style={s.txRow}>
              <View style={[s.txIcon, { borderColor: c }]}>
                <Text style={[s.txIconTxt, { color: c }]}>{pos ? '+' : '-'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.txDesc} numberOfLines={1}>{t.description || t.type}</Text>
                <Text style={s.txMeta}>{String(t.type).toUpperCase()} · {fmt(t.created_at)}</Text>
              </View>
              <Text style={[s.txAmt, { color: c }]}>{pos ? '+' : ''}{money(t.amount)}</Text>
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.modalBg}>
            <View style={s.modalSheet}>
              <Pressable onPress={() => setModal(false)}><Text style={s.back}>CANCEL</Text></Pressable>
              <Text style={s.title}>Withdraw</Text>
              <Text style={s.sub}>Available: {money(w.balance)}</Text>
              <Text style={s.label}>AMOUNT (₦) *</Text>
              <TextInput value={amt} onChangeText={setAmt} keyboardType="decimal-pad" placeholder="1000" placeholderTextColor={palette.textDim} style={s.input} />
              <Text style={s.label}>BANK NAME *</Text>
              <TextInput value={bank} onChangeText={setBank} placeholderTextColor={palette.textDim} style={s.input} />
              <Text style={s.label}>ACCOUNT NUMBER *</Text>
              <TextInput value={acct} onChangeText={setAcct} keyboardType="number-pad" maxLength={10} placeholderTextColor={palette.textDim} style={s.input} />
              <Text style={s.label}>ACCOUNT NAME *</Text>
              <TextInput value={name} onChangeText={setName} placeholderTextColor={palette.textDim} style={s.input} />
              <Pressable onPress={submit} disabled={wBusy} style={[s.cta, wBusy && { opacity: 0.5 }]}>
                {wBusy ? <ActivityIndicator color="#000" /> : <Text style={s.ctaText}>REQUEST WITHDRAWAL</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#b388ff' },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  card: { padding: 24, borderRadius: 24, marginTop: 20, marginBottom: 16 },
  balLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  balVal: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -2, marginTop: 4 },
  balRow: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  balCol: { flex: 1, alignItems: 'center' },
  balColVal: { fontSize: 15, fontWeight: '900', color: '#fff' },
  balColLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  balDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  bigBtn: { padding: 18, borderRadius: 14, borderWidth: 1.5, borderColor: '#b388ff', alignItems: 'center', backgroundColor: 'rgba(179,136,255,0.08)' },
  bigBtnTitle: { fontSize: 13, fontWeight: '900', color: '#b388ff', letterSpacing: 1.5 },
  bigBtnSub: { fontSize: 10, color: p.textMuted, marginTop: 4 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center', lineHeight: 18 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  txIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  txIconTxt: { fontSize: 16, fontWeight: '900' },
  txDesc: { fontSize: 13, fontWeight: '700', color: p.text },
  txMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '900' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: '#b388ff', alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
