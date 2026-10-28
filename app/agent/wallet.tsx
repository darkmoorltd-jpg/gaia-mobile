import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const TOPUPS = [{ amount: 2000, label: 'N2,000' }, { amount: 5000, label: 'N5,000' }, { amount: 10000, label: 'N10,000' }, { amount: 20000, label: 'N20,000' }];

function money(n: any) { return 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 }); }
function fmt(s?: string) { if (!s) return '—'; try { return new Date(s).toLocaleString(); } catch { return s; } }

export default function AgentWallet() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x: any) => x.user);

  const [w, setW] = useState<any>({ balance: 0, total_earned: 0, total_withdrawn: 0, transactions: [] });
  const [profile, setProfile] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [topupAmount, setTopupAmount] = useState<number | null>(null);
  const [topupRef, setTopupRef] = useState<string | null>(null);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wdAmount, setWdAmount] = useState('');
  const [wdBank, setWdBank] = useState('');
  const [wdAcct, setWdAcct] = useState('');
  const [wdName, setWdName] = useState('');
  const [wdBusy, setWdBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [a, p] = await Promise.all([
        supabase.rpc('agent_wallet_get'),
        supabase.from('user_profiles').select('bank_name,account_number,account_name').eq('user_id', user?.id).maybeSingle(),
      ]);
      if (!a.error && a.data) setW(a.data);
      if (!p.error && p.data) {
        setProfile(p.data);
        if (p.data.bank_name) setWdBank(p.data.bank_name);
        if (p.data.account_number) setWdAcct(p.data.account_number);
        if (p.data.account_name) setWdName(p.data.account_name);
      }
    } catch {}
    setBusy(false); setRef(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startTopup = (amt: number) => {
    setTopupAmount(amt);
    setTopupRef('GAIA_TOPUP_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6).toUpperCase());
  };

  const onPayMsg = async (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (d.status === 'success' && topupAmount && topupRef) {
        const r = await supabase.rpc('agent_wallet_topup_credit', { p_amount: topupAmount, p_reference: topupRef });
        if (r.error) { Alert.alert('Credit failed', r.error.message); }
        else { Alert.alert('Top-up successful', money(topupAmount) + ' added'); load(); }
        setTopupAmount(null); setTopupRef(null);
      } else if (d.status === 'closed') {
        setTopupAmount(null); setTopupRef(null);
      }
    } catch {}
  };

  const submitWithdraw = async () => {
    const amt = parseFloat(wdAmount);
    if (!amt || amt < 500) { Alert.alert('Min N500'); return; }
    if (amt > Number(w.balance)) { Alert.alert('Insufficient', 'You only have ' + money(w.balance)); return; }
    if (!wdBank || !wdAcct || !wdName) { Alert.alert('Fill all bank details'); return; }
    setWdBusy(true);
    const r = await supabase.rpc('agent_request_withdrawal', {
      p_amount: amt, p_bank_name: wdBank, p_account_number: wdAcct, p_account_name: wdName,
    });
    setWdBusy(false);
    if (r.error) { Alert.alert('Failed', r.error.message); return; }
    const d = r.data || {};
    if (d.ok === false) { Alert.alert('Failed', d.error || 'Try again'); return; }
    Alert.alert('Withdrawal requested', 'Admin will process in 1-3 business days');
    setWithdrawOpen(false); setWdAmount(''); load();
  };

  const paystackHtml = topupAmount && topupRef ? `
    <html><body style="background:#000;margin:0"><script src="https://js.paystack.co/v1/inline.js"></script>
    <script>PaystackPop.setup({key:'${PAYSTACK_PUBLIC}',email:'${user?.email || ''}',amount:${topupAmount * 100},currency:'NGN',ref:'${topupRef}',
    callback:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({status:'success',reference:r.reference}));},
    onClose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'}));}}).openIframe();</script></body></html>` : '';

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Text style={s.kicker}>WALLET</Text>
        <Text style={s.title}>My Money</Text>

        <LinearGradient colors={['#00cc6a', '#009e52', '#00582e']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.balanceCard}>
          <Text style={s.balLabel}>AVAILABLE BALANCE</Text>
          <Text style={s.balVal}>{money(w.balance)}</Text>
          <View style={s.balRow}>
            <View style={s.balCol}><Text style={s.balColVal}>{money(w.total_earned)}</Text><Text style={s.balColLbl}>EARNED</Text></View>
            <View style={s.balDiv} />
            <View style={s.balCol}><Text style={s.balColVal}>{money(w.total_withdrawn)}</Text><Text style={s.balColLbl}>WITHDRAWN</Text></View>
          </View>
        </LinearGradient>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable onPress={() => setWithdrawOpen(true)} style={[s.bigBtn, { borderColor: palette.neon }]}>
            <Text style={s.bigBtnTitle}>WITHDRAW</Text>
            <Text style={s.bigBtnSub}>To your bank</Text>
          </Pressable>
          <Pressable onPress={() => { const amt = TOPUPS[1].amount; startTopup(amt); }} style={[s.bigBtn, { borderColor: '#4fc3f7' }]}>
            <Text style={[s.bigBtnTitle, { color: '#4fc3f7' }]}>TOP UP</Text>
            <Text style={s.bigBtnSub}>Fund verification</Text>
          </Pressable>
        </View>

        <Text style={s.section}>QUICK TOP-UP</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TOPUPS.map((t) => (
            <Pressable key={t.amount} onPress={() => startTopup(t.amount)} style={s.topupChip}>
              <Text style={s.topupChipText}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.section}>TRANSACTIONS</Text>
        {busy && w.transactions.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && w.transactions.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyText}>No transactions yet. Earn N500 per approved verification.</Text></View>
        ) : null}

        {(w.transactions || []).map((t: any, i: number) => {
          const pos = Number(t.amount) > 0;
          const c = pos ? '#00ff88' : '#ffb300';
          return (
            <View key={i} style={s.txRow}>
              <View style={[s.txIcon, { borderColor: c }]}><Text style={[s.txIconTxt, { color: c }]}>{pos ? '+' : '-'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.txDesc} numberOfLines={1}>{t.description || t.type}</Text>
                <Text style={s.txMeta}>{t.type.toUpperCase()} · {fmt(t.created_at)}</Text>
              </View>
              <Text style={[s.txAmt, { color: c }]}>{pos ? '+' : ''}{money(t.amount)}</Text>
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!topupRef} animationType="slide" onRequestClose={() => { setTopupAmount(null); setTopupRef(null); }}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable onPress={() => { setTopupAmount(null); setTopupRef(null); }} style={{ padding: 16 }}>
            <Text style={{ color: palette.neon, fontWeight: '900', letterSpacing: 1 }}>CANCEL</Text>
          </Pressable>
          {paystackHtml ? <WebView source={{ html: paystackHtml }} onMessage={(e) => onPayMsg(e.nativeEvent.data)} javaScriptEnabled domStorageEnabled style={{ flex: 1, backgroundColor: '#000' }} /> : null}
        </View>
      </Modal>

      <Modal visible={withdrawOpen} animationType="slide" transparent onRequestClose={() => setWithdrawOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.modalBg}>
            <View style={s.modalSheet}>
              <Pressable onPress={() => setWithdrawOpen(false)}><Text style={s.back}>CANCEL</Text></Pressable>
              <Text style={s.title}>Withdraw</Text>
              <Text style={s.sub}>Available: {money(w.balance)}</Text>

              <Text style={s.label}>AMOUNT (N) *</Text>
              <TextInput value={wdAmount} onChangeText={setWdAmount} keyboardType="decimal-pad" placeholder="500" placeholderTextColor={palette.textDim} style={s.input} />

              <Text style={s.label}>BANK NAME *</Text>
              <TextInput value={wdBank} onChangeText={setWdBank} placeholderTextColor={palette.textDim} style={s.input} />

              <Text style={s.label}>ACCOUNT NUMBER *</Text>
              <TextInput value={wdAcct} onChangeText={setWdAcct} keyboardType="number-pad" maxLength={10} placeholderTextColor={palette.textDim} style={s.input} />

              <Text style={s.label}>ACCOUNT NAME *</Text>
              <TextInput value={wdName} onChangeText={setWdName} placeholderTextColor={palette.textDim} style={s.input} />

              <Pressable onPress={submitWithdraw} disabled={wdBusy} style={[s.cta, wdBusy && { opacity: 0.5 }]}>
                {wdBusy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={s.ctaText}>REQUEST WITHDRAWAL</Text>}
              </Pressable>
              <Text style={s.modalHint}>Min N500. Admin processes in 1-3 business days.</Text>
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
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  balanceCard: { padding: 24, borderRadius: 24, marginTop: 20, marginBottom: 8 },
  balLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.8)' },
  balVal: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -2, marginTop: 4 },
  balRow: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  balCol: { flex: 1, alignItems: 'center' },
  balColVal: { fontSize: 15, fontWeight: '900', color: '#fff' },
  balColLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  balDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  bigBtn: { flex: 1, padding: 18, borderRadius: 14, borderWidth: 1.5, backgroundColor: p.surface, alignItems: 'center' },
  bigBtnTitle: { fontSize: 13, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  bigBtnSub: { fontSize: 10, color: p.textMuted, marginTop: 4 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  topupChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  topupChipText: { fontSize: 13, fontWeight: '800', color: p.text },
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
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalHint: { fontSize: 10, color: p.textMuted, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
