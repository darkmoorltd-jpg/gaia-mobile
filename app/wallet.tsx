import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal,
  TextInput, Alert, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useTheme, typography, spacing, radius, shadows } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const API = 'https://gaia-api-xuly.onrender.com';
const TOPUP_URL = 'https://paystack.shop/pay/gaia-wallet-topup';

export default function Wallet() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [balance, setBalance] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [txns, setTxns] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  // Withdraw modal
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [acct, setAcct] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: w } = await supabase
        .from('farmer_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (w) {
        setBalance(Number(w.balance || 0));
        setEscrow(Number(w.escrow_balance || 0));
      } else {
        await supabase.from('farmer_wallets').insert({
          user_id: user.id, balance: 0,
          account_bank: 'Wema Bank', account_name: user.email,
          virtual_account: 'GAIA-' + user.id.slice(0, 8).toUpperCase(),
        });
      }
      const { data: ph } = await supabase
        .from('payment_history').select('*').eq('user_id', user.id)
        .order('paid_at', { ascending: false }).limit(20);
      setTxns(ph || []);
    } catch {}
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openWithdraw = async () => {
    setOpen(true);
    if (banks.length) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(API + '/wallet/banks', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setBanks(data.banks || []);
    } catch (e: any) {
      Alert.alert('Bank list failed', e?.message || 'Try again');
    }
  };

  const doWithdraw = async () => {
    if (!bankCode || acct.length < 10 || !amount || Number(amount) < 100) {
      Alert.alert('Check fields', 'Bank, 10-digit account, and amount >= N100');
      return;
    }
    if (Number(amount) > balance) {
      Alert.alert('Insufficient', 'Amount exceeds available balance');
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const bankName = banks.find((b) => b.code === bankCode)?.name || 'Bank';

      const r1 = await fetch(API + '/wallet/recipient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: user?.email?.split('@')[0] || 'Farmer', account_number: acct, bank_code: bankCode }),
      });
      const d1 = await r1.json();
      if (!d1.recipient_code) throw new Error(d1.error || 'Recipient failed');

      const r2 = await fetch(API + '/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ recipient_code: d1.recipient_code, amount: Number(amount), reason: 'GAIA wallet withdrawal' }),
      });
      const d2 = await r2.json();
      if (!d2.transfer_code) throw new Error(d2.error || 'Transfer failed');

      // Deduct locally
      const newBal = balance - Number(amount);
      await supabase.from('farmer_wallets').update({ balance: newBal }).eq('user_id', user!.id);
      setBalance(newBal);
      setOpen(false);
      setAmount('');
      setAcct('');
      Alert.alert('Sent', 'Transfer initiated. Bank: ' + bankName + '. You will receive a notification when it settles.');
    } catch (e: any) {
      Alert.alert('Withdrawal failed', e?.message || 'Try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Your money, secured.</Text>

        <LinearGradient colors={palette.gradientNeon as any} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.balanceValue}>N{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
          <View style={styles.balanceDivider} />
          <Text style={styles.balanceSub}>GAIA-{user?.id?.slice(0, 8).toUpperCase()} - Wema Bank</Text>
        </LinearGradient>

        <View style={styles.actionRow}>
          <Pressable onPress={() => Linking.openURL(TOPUP_URL)} style={styles.topUpBtn}>
            <Text style={styles.topUpText}>TOP UP</Text>
          </Pressable>
          <Pressable onPress={openWithdraw} style={styles.withdrawBtn}>
            <Text style={styles.withdrawText}>WITHDRAW</Text>
          </Pressable>
        </View>

        <View style={styles.escrowCard}>
          <Text style={styles.escrowLabel}>IN ESCROW</Text>
          <Text style={styles.escrowValue}>N{escrow.toLocaleString()}</Text>
        </View>

        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && txns.length === 0 ? <Text style={styles.empty}>No activity yet.</Text> : null}
        {txns.map((t, i) => (
          <View key={i} style={styles.txnRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txnLabel}>{t.plan?.toUpperCase() || 'Payment'}</Text>
              <Text style={styles.txnSub}>{new Date(t.paid_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.txnAmt}>N{(t.amount / 100).toFixed(2)}</Text>
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>WITHDRAW</Text>
            <Text style={styles.modalTitle}>N{balance.toLocaleString()} available</Text>

            <Text style={styles.label}>SELECT BANK</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {banks.slice(0, 30).map((b) => (
                  <Pressable
                    key={b.code}
                    onPress={() => setBankCode(b.code)}
                    style={[styles.bankChip, bankCode === b.code && styles.bankChipActive]}
                  >
                    <Text style={[styles.bankChipTxt, bankCode === b.code && styles.bankChipTxtActive]}>
                      {b.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>ACCOUNT NUMBER</Text>
            <TextInput
              value={acct}
              onChangeText={setAcct}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="0123456789"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Text style={styles.label}>AMOUNT (N)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="1000"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Pressable onPress={doWithdraw} disabled={sending} style={styles.submit}>
              <Text style={styles.submitTxt}>{sending ? 'SENDING...' : 'SEND'}</Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
              <Text style={styles.cancelTxt}>CANCEL</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: spacing.sm },
  balanceCard: { borderRadius: radius.xl, padding: spacing.xxl, marginTop: spacing.xl, ...shadows.neon },
  balanceLabel: { ...typography.micro, color: 'rgba(0,0,0,0.7)' },
  balanceValue: { fontSize: 40, fontWeight: '900', color: '#000', marginTop: 8, letterSpacing: -1.5 },
  balanceDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.15)', marginVertical: spacing.lg },
  balanceSub: { ...typography.caption, color: 'rgba(0,0,0,0.7)', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  topUpBtn: { flex: 1, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  topUpText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  withdrawBtn: { flex: 1, padding: 18, borderRadius: 14, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  withdrawText: { fontSize: 14, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  escrowCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  escrowLabel: { ...typography.micro, color: p.textMuted },
  escrowValue: { fontSize: 22, fontWeight: '900', color: p.warning, marginTop: 4 },
  sectionLabel: { ...typography.micro, color: p.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border },
  txnLabel: { fontSize: 14, fontWeight: '700', color: p.text },
  txnSub: { fontSize: 11, color: p.textDim, marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: '900', color: p.neon },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '88%' },
  modalKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 4, marginBottom: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: p.border, color: '#fff', fontSize: 15 },
  bankChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: p.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  bankChipActive: { backgroundColor: p.neon, borderColor: p.neon },
  bankChipTxt: { fontSize: 12, color: '#fff', fontWeight: '600' },
  bankChipTxtActive: { color: p.obsidian, fontWeight: '900' },
  submit: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  submitTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  cancel: { marginTop: 10, padding: 16, alignItems: 'center' },
  cancelTxt: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
});
