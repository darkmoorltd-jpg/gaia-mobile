import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import {
  fetchCart, createOrder, clearCart, makeOrderRef, naira,
} from '../src/utils/marketplace';

const PAYSTACK_CHECKOUT = 'https://paystack.shop/pay/gaia-marketplace';

export default function Checkout() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [placing, setPlacing] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState<'home' | 'pickup'>('home');

  useFocusEffect(useCallback(() => {
    (async () => {
      if (!user) return;
      setBusy(true);
      const rows = await fetchCart(user.id);
      setItems(rows);
      // Prefill
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
    setPlacing(true);
    const ref = makeOrderRef();

    // Create one order per item (per seller)
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

      Alert.alert(
        'Order placed',
        'Reference: ' + ref + '\n\nProceed to Paystack to complete payment.',
        [
          { text: 'Pay now', onPress: () => Linking.openURL(PAYSTACK_CHECKOUT) },
          { text: 'Later', style: 'cancel' },
        ],
      );
      router.replace('/marketplace-orders' as any);
    } catch (e: any) {
      setPlacing(false);
      Alert.alert('Failed', e.message || 'Could not place order');
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
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Delivery address"
          placeholderTextColor={palette.textDim}
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          multiline
        />

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
            🛡️ Escrow protected. Your payment is held securely until you confirm delivery.
          </Text>
        </View>

        <Pressable onPress={placeOrder} disabled={placing} style={[styles.cta, placing && { opacity: 0.5 }]}>
          {placing ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>PAY {naira(total)} WITH PAYSTACK</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 16 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  input: {
    borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: p.text, fontSize: 14, marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 12, backgroundColor: p.surface,
    borderWidth: 1.5, borderColor: p.border, marginBottom: 8,
  },
  optionRowActive: { borderColor: p.neon, backgroundColor: p.neonSoft },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: p.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: p.neon, backgroundColor: p.neon },
  optionTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: p.text },
  optionPrice: { fontSize: 13, fontWeight: '800', color: p.neon },
  summary: {
    marginTop: 8, padding: 20, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sumLbl: { fontSize: 14, color: p.textMuted },
  sumVal: { fontSize: 14, color: p.text, fontWeight: '700' },
  divider: { height: 1, backgroundColor: p.border, marginVertical: 10 },
  totalLbl: { fontSize: 16, fontWeight: '800', color: p.text },
  totalVal: { fontSize: 20, fontWeight: '900', color: p.neon },
  escrow: {
    marginTop: 16, padding: 14, borderRadius: 12,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.border,
  },
  escrowTxt: { fontSize: 12, color: p.neon, lineHeight: 18 },
  cta: {
    marginTop: 20, paddingVertical: 18, borderRadius: 14,
    backgroundColor: p.neon, alignItems: 'center',
  },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
