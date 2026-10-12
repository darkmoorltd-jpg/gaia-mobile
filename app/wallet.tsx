import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Modal, TextInput, Alert, RefreshControl,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import {
  walletMe, depositInit, depositVerify, buyScansWithWallet, fmtN, relTime,
  type WalletInfo, type WalletTxn,
} from '../src/utils/wallet';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const QUICK = [500, 1000, 2000, 5000, 10000, 20000];
const SCAN_PLANS = [
  { key: 'starter',    name: 'Starter',    scans: 150,  price: 3000 },
  { key: 'pro',        name: 'Pro',        scans: 300,  price: 5000 },
  { key: 'business',   name: 'Business',   scans: 1000, price: 10000 },
  { key: 'enterprise', name: 'Enterprise', scans: 5000, price: 20000 },
];

export default function Wallet() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const scansRemaining = useAuth((s: any) => s.scansRemaining);
  const refreshScans = useAuth((s: any) => s.refreshScans);

  const [wallet, setWallet] = useState<WalletInfo>({
    balance: 0, escrow: 0, account_number: null, account_name: null,
    bank_name: null, provisioned: false,
  });
  const [hasPin, setHasPin] = useState(false);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [depositAmount, setDepositAmount] = useState('');
  const [depositRef, setDepositRef] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [buyPlan, setBuyPlan] = useState<any>(null);
  const [buyPin, setBuyPin] = useState('');
  const [buyBusy, setBuyBusy] = useState(false);
  const buyPinTimer = useRef<any>(null);

  useEffect(() => {
    if (buyPinTimer.current) { clearTimeout(buyPinTimer.current); buyPinTimer.current = null; }
    if (buyBusy || !buyPlan) return;
    if (!/^[0-9]{4}$/.test(buyPin)) return;
    buyPinTimer.current = setTimeout(() => { confirmBuy(); }, 350);
    return () => { if (buyPinTimer.current) clearTimeout(buyPinTimer.current); };
  }, [buyPin, buyPlan, buyBusy]);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const res = await walletMe();
    if (res) {
      setWallet(res.wallet);
      setTxns(res.transactions);
    }
    // Check PIN via backend (single source of truth)
    try {
      const { hasWalletPin } = await import('../src/utils/wallet');
      setHasPin(await hasWalletPin());
    } catch { setHasPin(false); }
    setBusy(false);
    setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copyAcct = async () => {
    if (!wallet.account_number) return;
    await Clipboard.setStringAsync(wallet.account_number);
    Alert.alert('Copied', wallet.account_number);
  };

  const notReady = () => Alert.alert('Account not ready', 'Verify your identity to unlock your GAIA account number.');

  const startDeposit = async () => {
    const amt = Number(depositAmount);
    if (!amt || amt < 100) { Alert.alert('Minimum N100'); return; }
    try {
      const d = await depositInit(amt);
      setDepositRef(d.reference);
    } catch (e: any) { Alert.alert('Failed', e.message || 'Try again'); }
  };

  const html = () => {
    if (!depositRef) return '';
    const amt = Number(depositAmount);
    const email = user?.email || '';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"/>' +
      '<script src="https://js.paystack.co/v1/inline.js"></script>' +
      '<style>html,body{margin:0;background:#0a0e0c}</style></head><body><script>' +
      'window.addEventListener("load", function() {' +
      '  try { PaystackPop.setup({' +
      '    key: "' + PAYSTACK_PUBLIC + '", email: "' + email + '",' +
      '    amount: ' + Math.round(amt * 100) + ', currency: "NGN",' +
      '    ref: "' + depositRef + '", label: "GAIA Top Up",' +
      '    onClose: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ status: "closed" })); },' +
      '    callback: function(r) { window.ReactNativeWebView.postMessage(JSON.stringify({ status: "success", reference: r.reference })); }' +
      '  }).openIframe(); } catch (e) {' +
      '    window.ReactNativeWebView.postMessage(JSON.stringify({ status: "error", message: String(e) }));' +
      '  }' +
      '});' +
      '</script></body></html>';
  };

  const onDepMsg = async (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (d.status === 'closed') { setDepositRef(null); return; }
      if (d.status === 'error') { Alert.alert('Error', d.message); setDepositRef(null); return; }
      if (d.status === 'success') {
        setVerifying(true);
        try {
          const res = await depositVerify(d.reference);
          setDepositRef(null);
          setDepositAmount('');
          await load();
          Alert.alert('Success', 'Added ' + fmtN(res.amount || 0, 2));
        } catch (e: any) {
          Alert.alert('Verify failed', e.message || 'Try again');
        } finally { setVerifying(false); }
      }
    } catch {}
  };

  const startBuyPlan = (p: any) => {
    if (!hasPin) {
      Alert.alert('Set your PIN first', 'Go to Wallet then Set PIN before buying scans.', [
        { text: 'Set PIN', onPress: () => router.push('/wallet-set-pin' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setBuyPlan(p);
    setBuyPin('');
  };

  const confirmBuy = async () => {
    if (!buyPlan || !/^[0-9]{4}$/.test(buyPin)) { Alert.alert('Enter your 4-digit PIN'); return; }
    setBuyBusy(true);
    try {
      const res = await buyScansWithWallet(buyPlan.key, buyPin);
      await refreshScans();
      await load();
      setBuyPlan(null);
      Alert.alert('Scans added', '+' + res.scans_added + ' scans. New balance ' + fmtN(res.balance, 2));
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Try again');
    } finally { setBuyBusy(false); }
  };

  const txnIcon = (t: string) => {
    if (t === 'deposit') return '+';
    if (t === 'withdrawal') return '-';
    if (t === 'p2p_send') return '>';
    if (t === 'p2p_receive') return '<';
    if (t === 'scan_purchase') return 'S';
    if (t === 'bill') return '*';
    return '.';
  };
  const txnColor = (t: WalletTxn) => {
    if (t.status === 'failed' || t.status === 'refunded') return '#ff3b5c';
    if (t.direction === 'in') return '#00ff88';
    return '#8899a6';
  };
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
        <Pressable
          onPress={() => {
            if (typeof router.canGoBack === 'function' && router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile' as any);
            }
          }}
          style={{ paddingVertical: 8, paddingHorizontal: 4, alignSelf: 'flex-start', marginBottom: 8 }}
          hitSlop={10}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: palette.neon }}>{'<'} BACK</Text>
        </Pressable>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.sub}>Your money, secured.</Text>

        <LinearGradient colors={['#00c853', '#009e52', '#003820']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.heroBal}>{fmtN(wallet.balance, 2)}</Text>

          {wallet.provisioned ? (
            <Pressable onPress={copyAcct} style={styles.acctBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.acctNum}>{wallet.account_number}</Text>
                <Text style={styles.acctName} numberOfLines={1}>{wallet.account_name}</Text>
                <Text style={styles.acctBank}>{wallet.bank_name}</Text>
              </View>
              <Text style={styles.copyBtn}>COPY</Text>
            </Pressable>
          ) : (
            <Pressable onPress={notReady} style={styles.acctBox}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.acctNum, { fontSize: 14 }]}>Account not provisioned</Text>
                <Text style={styles.acctName}>Verify your identity to activate</Text>
              </View>
            </Pressable>
          )}
        </LinearGradient>

        <View style={styles.actionGrid}>
          <Pressable onPress={() => {}} style={styles.actBtn}><Text style={styles.actIcon}>+</Text><Text style={styles.actLbl}>ADD</Text></Pressable>
          <Pressable onPress={() => router.push('/wallet-send' as any)} style={styles.actBtn}><Text style={styles.actIcon}>{'>'}</Text><Text style={styles.actLbl}>SEND</Text></Pressable>
          <Pressable onPress={() => router.push('/wallet-withdraw' as any)} style={styles.actBtn}><Text style={styles.actIcon}>-</Text><Text style={styles.actLbl}>WITHDRAW</Text></Pressable>
          <Pressable onPress={() => router.push('/wallet-receive' as any)} style={styles.actBtn}><Text style={styles.actIcon}>#</Text><Text style={styles.actLbl}>RECEIVE</Text></Pressable>
        </View>

        <View style={styles.actionGrid}>
          <Pressable onPress={() => router.push('/wallet-statement' as any)} style={styles.actBtn}><Text style={styles.actIcon}>~</Text><Text style={styles.actLbl}>STATEMENT</Text></Pressable>
          <Pressable onPress={() => router.push('/wallet-set-pin' as any)} style={styles.actBtn}><Text style={styles.actIcon}>{hasPin ? '*' : '!'}</Text><Text style={styles.actLbl}>{hasPin ? 'CHANGE PIN' : 'SET PIN'}</Text></Pressable>
          <Pressable onPress={() => router.push('/wallet-preferences' as any)} style={styles.actBtn}><Text style={styles.actIcon}>@</Text><Text style={styles.actLbl}>PREFERENCES</Text></Pressable>
        </View>

        {!hasPin ? (
          <Pressable onPress={() => router.push('/wallet-set-pin' as any)} style={styles.pinWarn}>
            <Text style={styles.pinWarnTxt}>!  Set a 4-digit PIN to enable transfers</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionLabel}>ADD MONEY</Text>
        <View style={styles.quickRow}>
          {QUICK.map((a) => (
            <Pressable key={a} onPress={() => setDepositAmount(String(a))} style={[styles.quickChip, depositAmount === String(a) && styles.quickChipOn]}>
              <Text style={[styles.quickChipTxt, depositAmount === String(a) && styles.quickChipTxtOn]}>{fmtN(a, 0)}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={depositAmount} onChangeText={setDepositAmount} keyboardType="number-pad" placeholder="Custom amount" placeholderTextColor={palette.textDim} style={styles.amountInput} />
        <Pressable onPress={startDeposit} disabled={!depositAmount || Number(depositAmount) < 100} style={[styles.depositBtn, (!depositAmount || Number(depositAmount) < 100) && { opacity: 0.4 }]}>
          <Text style={styles.depositBtnTxt}>{'ADD ' + (depositAmount ? fmtN(Number(depositAmount), 0) : 'MONEY') + ' VIA CARD'}</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>BUY SCANS FROM WALLET  ({scansRemaining} left)</Text>
        {SCAN_PLANS.map((p) => (
          <Pressable key={p.key} onPress={() => startBuyPlan(p)} style={styles.scanPlanCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanPlanName}>{p.name.toUpperCase()}</Text>
              <Text style={styles.scanPlanScans}>{p.scans} scans</Text>
            </View>
            <Text style={styles.scanPlanPrice}>{fmtN(p.price, 0)}</Text>
          </Pressable>
        ))}

        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 10 }} /> : null}
        {!busy && txns.length === 0 ? <Text style={styles.empty}>No activity yet.</Text> : null}

        {txns.slice(0, 8).map((t) => (
          <Pressable key={t.id} onPress={() => router.push(('/wallet-receipt?ref=' + t.reference) as any)} style={styles.txnRow}>
            <View style={[styles.txnIconWrap, { borderColor: txnColor(t) }]}>
              <Text style={[styles.txnIcon, { color: txnColor(t) }]}>{txnIcon(t.type)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txnTitle} numberOfLines={1}>
                {t.type === 'deposit' ? 'Wallet top up' :
                 t.type === 'withdrawal' ? ('To ' + (t.counterparty_name || 'Bank')) :
                 t.type === 'p2p_send' ? ('To ' + (t.counterparty_name || 'GAIA user')) :
                 t.type === 'p2p_receive' ? ('From ' + (t.counterparty_name || 'GAIA user')) :
                 t.type === 'scan_purchase' ? (t.counterparty_name || 'Scan purchase') :
                 t.type.toUpperCase()}
              </Text>
              <Text style={styles.txnMeta}>{relTime(t.created_at)} - <Text style={{ color: statColor(t.status) }}>{t.status.toUpperCase()}</Text></Text>
            </View>
            <Text style={[styles.txnAmt, { color: txnColor(t) }]}>{(t.direction === 'in' ? '+' : '-') + fmtN(t.amount, 2)}</Text>
          </Pressable>
        ))}

        {txns.length > 8 ? (
          <Pressable onPress={() => router.push('/wallet-statement' as any)} style={styles.moreBtn}>
            <Text style={styles.moreBtnTxt}>VIEW FULL STATEMENT</Text>
          </Pressable>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!depositRef} animationType="slide" onRequestClose={() => setDepositRef(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setDepositRef(null)}><Text style={styles.modalClose}>CLOSE</Text></Pressable>
            <Text style={styles.modalTitle}>{'ADD ' + fmtN(Number(depositAmount), 0)}</Text>
            <View style={{ width: 50 }} />
          </View>
          {verifying ? (
            <View style={styles.modalCenter}><ActivityIndicator color="#00ff88" size="large" /><Text style={styles.modalCenterText}>Crediting your wallet...</Text></View>
          ) : (
            <WebView originWhitelist={['*']} source={{ html: html() }} onMessage={(e) => onDepMsg(e.nativeEvent.data)} javaScriptEnabled domStorageEnabled startInLoadingState style={{ flex: 1, backgroundColor: '#0a0e0c' }} />
          )}
        </View>
      </Modal>

      <Modal visible={!!buyPlan} animationType="slide" transparent onRequestClose={() => setBuyPlan(null)}>
        <View style={styles.pinBg}>
          <View style={styles.pinSheet}>
            <Text style={styles.pinTitle}>{buyPlan ? buyPlan.name.toUpperCase() : ''}</Text>
            <Text style={styles.pinSub}>{buyPlan ? buyPlan.scans + ' scans - ' + fmtN(buyPlan.price, 0) : ''}</Text>
            <Text style={styles.pinLabel}>ENTER 4-DIGIT PIN</Text>
            <TextInput value={buyPin} onChangeText={(v) => setBuyPin(v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.pinInput} />
            <Pressable onPress={confirmBuy} disabled={buyBusy || buyPin.length !== 4} style={[styles.pinBtn, (buyBusy || buyPin.length !== 4) && { opacity: 0.4 }]}>
              {buyBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.pinBtnTxt}>PAY FROM WALLET</Text>}
            </Pressable>
            <Pressable onPress={() => setBuyPlan(null)} style={styles.pinCancel}><Text style={styles.pinCancelTxt}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4 },
  hero: { marginTop: 20, padding: 24, borderRadius: 22, overflow: 'hidden' },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' },
  heroBal: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -2, marginTop: 6 },
  acctBox: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  acctNum: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  acctName: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  acctBank: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  copyBtn: { fontSize: 10, fontWeight: '900', color: '#000', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, letterSpacing: 1.5 },
  actionGrid: { flexDirection: 'row', marginTop: 16, gap: 8 },
  actBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  actIcon: { fontSize: 22, fontWeight: '900', color: p.neon, marginBottom: 4 },
  actLbl: { fontSize: 9, fontWeight: '900', color: p.text, letterSpacing: 1.2 },
  pinWarn: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,179,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)' },
  pinWarnTxt: { fontSize: 12, color: '#ffb300', fontWeight: '700', textAlign: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  quickChipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  quickChipTxt: { fontSize: 12, fontWeight: '800', color: p.textMuted },
  quickChipTxtOn: { color: p.neon },
  amountInput: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 18, fontWeight: '900', marginBottom: 12 },
  depositBtn: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  depositBtnTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  scanPlanCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  scanPlanName: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1.2 },
  scanPlanScans: { fontSize: 15, fontWeight: '900', color: p.text, marginTop: 2 },
  scanPlanPrice: { fontSize: 18, fontWeight: '900', color: p.neon },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  txnIconWrap: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  txnIcon: { fontSize: 16, fontWeight: '900' },
  txnTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  txnMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: '900' },
  moreBtn: { marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  moreBtnTxt: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  modalContainer: { flex: 1, backgroundColor: '#0a0e0c' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#1a2820' },
  modalClose: { fontSize: 11, fontWeight: '900', color: '#00ff88', letterSpacing: 1.5 },
  modalTitle: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  modalCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  modalCenterText: { fontSize: 14, color: '#00ff88', fontWeight: '700' },
  pinBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  pinSheet: { backgroundColor: '#0f1512', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  pinTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  pinSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 20 },
  pinLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  pinInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 16, color: '#fff', fontSize: 24, letterSpacing: 12, textAlign: 'center', fontWeight: '900' },
  pinBtn: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  pinBtnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  pinCancel: { marginTop: 12, padding: 12, alignItems: 'center' },
  pinCancelTxt: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
});
