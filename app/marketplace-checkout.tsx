import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import {
  fetchCart, createOrder, clearCart, makeOrderRef, naira, payOrderFromWallet,
} from '../src/utils/marketplace';
import { walletMe, hasWalletPin } from '../src/utils/wallet';

export default function Checkout() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [pinSet, setPinSet] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState<'home' | 'pickup'>('home');

  const [showPay, setShowPay] = useState(false);
  const [orderRef, setOrderRef] = useState('');
  const [pin, setPin] = useState('');
  const [paying, setPaying] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      if (!user) return;
      setBusy(true);
      const rows = await fetchCart(user.id);
      setItems(rows);

      const w = await walletMe();
      if (w) setBalance(Number(w.wallet.balance || 0));
      setPinSet(await hasWalletPin());

      try {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('first_name,last_name,phone,state')
          .eq('user_id', user.id)
          .maybeSingle();
        if (prof) {
          const n = ((prof.first_name || '') + ' ' + (prof.last_name || '')).trim();
          if (n) setName(n);
          if (prof.phone) setPhone(prof.phone);
          if (prof.state) setAddress(prof.state);
        }
      } catch {}
      setBusy(false);
    })();
  }, [user]));

  const subtotal = items.reduce((a, it) => a + Number((it.listing && it.listing.price) || 0) * it.quantity, 0);
  const delivery = method === 'home' && subtotal > 0 ? 2500 : 0;
  const total = subtotal + delivery;
  const shortfall = Math.max(0, total - balance);

  const placeOrder = async () => {
    if (!user) return;
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Missing info', 'Name, phone, and address are required');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Cart empty');
      return;
    }
    if (!pinSet) {
      Alert.alert('PIN required', 'Set your transfer PIN before paying.', [
        { text: 'Set PIN', onPress: () => router.push('/wallet-set-pin' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (shortfall > 0) {
      Alert.alert('Insufficient balance', 'Add ' + naira(shortfall) + ' to your wallet to continue.', [
        { text: 'Add money', onPress: () => router.push('/wallet' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    setPlacing(true);
    const ref = makeOrderRef();

    try {
      for (const it of items) {
        const l = it.listing;
        if (!l) continue;
        const itemSub = Number(l.price) * it.quantity;
        await createOrder({
          order_ref: ref + '-' + it.id,
          buyer_id: user.id,
          seller_id: l.seller_id,
          listing_id: l.id,
          listing_title: l.title,
          listing_image: (l.images && l.images[0]) || null,
          quantity: it.quantity,
          subtotal: itemSub,
          delivery_fee: method === 'home' ? 2500 : 0,
          total: itemSub + (method === 'home' ? 2500 : 0),
          status: 'pending',
          delivery_address: address.trim(),
          delivery_method: method,
          buyer_name: name.trim(),
          buyer_phone: phone.trim(),
          payment_ref: ref,
        });
      }
      await clearCart(user.id);
      setPlacing(false);
      setOrderRef(ref);
      setPin('');
      setShowPay(true);
    } catch (e: any) {
      setPlacing(false);
      Alert.alert('Failed', e.message || 'Could not place order');
    }
  };

  const confirmPay = async () => {
    if (!/^[0-9]{4}$/.test(pin)) {
      Alert.alert('Invalid PIN', 'Enter your 4-digit PIN');
      return;
    }
    setPaying(true);
    try {
      const r = await payOrderFromWallet(orderRef, pin);
      setShowPay(false);
      setPaying(false);
      Alert.alert(
        'Payment successful',
        'Paid ' + naira(r.total_charged) + ' from your wallet.\n\n' +
        'Funds are held in escrow until you confirm delivery.',
        [{ text: 'View orders', onPress: () => router.replace('/marketplace-orders' as any) }],
      );
    } catch (e: any) {
      setPaying(false);
      Alert.alert('Payment failed', e.message || 'Try again');
    }
  };

  if (busy) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Checkout</Text>

        <Text style={styles.section}>DELIVERY ADDRESS</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={palette.textDim} style={styles.input} />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor={palette.textDim} style={styles.input} />
        <TextInput value={address} onChangeText={setAddress} placeholder="Delivery address" placeholderTextColor={palette.textDim} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline />

        <Text style={styles.section}>DELIVERY METHOD</Text>
        <Pressable onPress={() => setMethod('home')} style={[styles.optionRow, method === 'home' && styles.optionRowActive]}>
          <View style={[styles.radio, method === 'home' && styles.radioActive]} />
          <Text style={styles.optionTxt}>Home delivery</Text>
          <Text style={styles.optionPrice}>{naira(2500)}</Text>
        </Pressable>
        <Pressable onPress={() => setMethod('pickup')} style={[styles.optionRow, method === 'pickup' && styles.optionRowActive]}>
          <View style={[styles.radio, method === 'pickup' && styles.radioActive]} />
          <Text style={styles.optionTxt}>Pickup at seller</Text>
          <Text style={styles.optionPrice}>Free</Text>
        </Pressable>

        <Text style={styles.section}>WALLET</Text>
        <View style={styles.walletBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.walletBal}>{naira(balance)}</Text>
          </View>
          {shortfall > 0 ? (
            <Pressable onPress={() => router.push('/wallet' as any)} style={styles.topupBtn}>
              <Text style={styles.topupTxt}>ADD MONEY</Text>
            </Pressable>
          ) : null}
        </View>
        {shortfall > 0 ? (
          <Text style={styles.warnText}>You need {naira(shortfall)} more to complete this order.</Text>
        ) : null}
        {!pinSet ? (
          <Pressable onPress={() => router.push('/wallet-set-pin' as any)} style={styles.pinWarn}>
            <Text style={styles.pinWarnTxt}>SET YOUR PIN FIRST</Text>
          </Pressable>
        ) : null}

        <Text style={styles.section}>ORDER SUMMARY</Text>
        <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLbl}>Subtotal ({items.length} items)</Text>
            <Text style={styles.sumVal}>{naira(subtotal)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLbl}>Delivery</Text>
            <Text style={styles.sumVal}>{naira(delivery)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.sumRow}>
            <Text style={styles.totalLbl}>Total</Text>
            <Text style={styles.totalVal}>{naira(total)}</Text>
          </View>
        </View>

        <View style={styles.escrow}>
          <Text style={styles.escrowTxt}>
            Funds held in escrow. Released to seller only after you confirm delivery.
          </Text>
        </View>

        <Pressable onPress={placeOrder} disabled={placing} style={[styles.cta, placing && { opacity: 0.5 }]}>
          {placing ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>PAY {naira(total)}</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showPay} animationType="slide" transparent onRequestClose={() => setShowPay(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Confirm payment</Text>
            <Text style={styles.modalSub}>
              {naira(total)} from your wallet
            </Text>

            <View style={styles.modalRow}>
              <Text style={styles.modalLbl}>Balance after</Text>
              <Text style={styles.modalVal}>{naira(Math.max(0, balance - total))}</Text>
            </View>

            <Text style={styles.pinLbl}>ENTER 4-DIGIT PIN</Text>
            <TextInput
              value={pin}
              onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.pinInput}
            />

            <Pressable
              onPress={confirmPay}
              disabled={paying || pin.length !== 4}
              style={[styles.payBtn, (paying || pin.length !== 4) && { opacity: 0.4 }]}
            >
              {paying ? <ActivityIndicator color="#000" /> : <Text style={styles.payTxt}>PAY {naira(total)}</Text>}
            </Pressable>

            <Pressable onPress={() => setShowPay(false)} style={styles.cancelLink}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 16 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  input: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: p.text, fontSize: 14, marginBottom: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.border, marginBottom: 8 },
  optionRowActive: { borderColor: p.neon, backgroundColor: p.neonSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: p.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: p.neon, backgroundColor: p.neon },
  optionTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: p.text },
  optionPrice: { fontSize: 13, fontWeight: '800', color: p.neon },
  walletBox: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  walletLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  walletBal: { fontSize: 22, fontWeight: '900', color: p.neon, marginTop: 4 },
  topupBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: p.neon },
  topupTxt: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  warnText: { fontSize: 12, color: p.warning, marginTop: 8, fontWeight: '700' },
  pinWarn: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)', alignItems: 'center' },
  pinWarnTxt: { fontSize: 11, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
  summary: { marginTop: 8, padding: 20, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sumLbl: { fontSize: 14, color: p.textMuted },
  sumVal: { fontSize: 14, color: p.text, fontWeight: '700' },
  divider: { height: 1, backgroundColor: p.border, marginVertical: 10 },
  totalLbl: { fontSize: 16, fontWeight: '800', color: p.text },
  totalVal: { fontSize: 20, fontWeight: '900', color: p.neon },
  escrow: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.border },
  escrowTxt: { fontSize: 12, color: p.neon, lineHeight: 18 },
  cta: { marginTop: 20, paddingVertical: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.obsidian, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  modalSub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  modalLbl: { fontSize: 13, color: p.textMuted },
  modalVal: { fontSize: 14, fontWeight: '800', color: p.text },
  pinLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  pinInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 16, color: '#fff', fontSize: 24, letterSpacing: 12, textAlign: 'center', fontWeight: '900' },
  payBtn: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  payTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  cancelLink: { marginTop: 12, padding: 12, alignItems: 'center' },
  cancelTxt: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
});
