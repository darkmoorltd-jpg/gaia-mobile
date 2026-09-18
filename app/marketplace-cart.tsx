import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { fetchCart, updateCartQty, naira } from '../src/utils/marketplace';

export default function Cart() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const rows = await fetchCart(user.id);
    setItems(rows);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setQty = async (cartId: number, q: number) => {
    await updateCartQty(cartId, q);
    load();
  };

  const subtotal = items.reduce((a, it) => a + Number((it.listing && it.listing.price) || 0) * it.quantity, 0);
  const delivery = subtotal > 0 ? 2500 : 0;
  const total = subtotal + delivery;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Cart ({items.length})</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {busy ? <ActivityIndicator color={palette.neon} style={{ marginVertical: 30 }} /> : null}

        {!busy && items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={styles.empty}>Your cart is empty</Text>
            <Pressable onPress={() => router.push('/marketplace' as any)} style={styles.shopBtn}>
              <Text style={styles.shopBtnTxt}>BROWSE MARKETPLACE</Text>
            </Pressable>
          </View>
        ) : null}

        {items.map((it) => {
          const l = it.listing;
          if (!l) return null;
          const img = (l.images && l.images[0]) || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400';
          return (
            <View key={it.id} style={styles.card}>
              <Image source={{ uri: img }} style={styles.img} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>{l.title}</Text>
                <Text style={styles.price}>{naira(l.price)} {l.unit}</Text>
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => setQty(it.id, it.quantity - 1)} style={styles.qtyBtn}>
                    <Text style={styles.qtyTxt}>-</Text>
                  </Pressable>
                  <Text style={styles.qtyVal}>{it.quantity}</Text>
                  <Pressable onPress={() => setQty(it.id, it.quantity + 1)} style={styles.qtyBtn}>
                    <Text style={styles.qtyTxt}>+</Text>
                  </Pressable>
                  <Text style={styles.sub}>Sub: {naira(l.price * it.quantity)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {items.length > 0 ? (
          <View style={styles.summary}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLbl}>Subtotal</Text>
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

            <Pressable onPress={() => router.push('/marketplace-checkout' as any)} style={styles.cta}>
              <Text style={styles.ctaTxt}>PROCEED TO CHECKOUT</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  empty: { fontSize: 16, color: p.textMuted, marginBottom: 20 },
  shopBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: p.neon },
  shopBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10,
  },
  img: { width: 80, height: 80, borderRadius: 10 },
  name: { fontSize: 14, fontWeight: '700', color: p.text },
  price: { fontSize: 15, color: p.neon, fontWeight: '900', marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyTxt: { fontSize: 16, color: p.neon, fontWeight: '900', lineHeight: 16 },
  qtyVal: { fontSize: 14, fontWeight: '800', color: p.text, minWidth: 20, textAlign: 'center' },
  sub: { fontSize: 11, color: p.textMuted, marginLeft: 8 },
  summary: {
    marginTop: 20, padding: 20, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sumLbl: { fontSize: 14, color: p.textMuted },
  sumVal: { fontSize: 14, color: p.text, fontWeight: '700' },
  divider: { height: 1, backgroundColor: p.border, marginVertical: 10 },
  totalLbl: { fontSize: 16, fontWeight: '800', color: p.text },
  totalVal: { fontSize: 20, fontWeight: '900', color: p.neon },
  cta: {
    marginTop: 16, paddingVertical: 18, borderRadius: 14,
    backgroundColor: p.neon, alignItems: 'center',
  },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
