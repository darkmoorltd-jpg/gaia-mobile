import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  fetchSellerListings, deleteListing, fetchSellerOrders, naira,
} from '../src/utils/marketplace';

export default function SellerStore() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [ls, os] = await Promise.all([
      fetchSellerListings(user.id),
      fetchSellerOrders(user.id),
    ]);
    setListings(ls);
    setOrders(os);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (id: number) => {
    Alert.alert('Delete listing?', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteListing(id); load(); } },
    ]);
  };

  const revenue = orders
    .filter((o) => o.status === 'confirmed')
    .reduce((a, b) => a + Number(b.total || 0), 0);

  const pending = orders.filter((o) => o.status === 'paid' || o.status === 'pending').length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>My Store</Text>
        <Text style={styles.sub}>{user?.email}</Text>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{listings.length}</Text>
            <Text style={styles.statLbl}>LISTINGS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{pending}</Text>
            <Text style={styles.statLbl}>PENDING</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{naira(revenue)}</Text>
            <Text style={styles.statLbl}>REVENUE</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push('/marketplace-sell' as any)} style={styles.addBtn}>
            <Text style={styles.addBtnTxt}>+ NEW LISTING</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/marketplace-incoming' as any)} style={styles.ordersBtn}>
            <Text style={styles.ordersBtnTxt}>ORDERS ({pending})</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>MY LISTINGS</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginVertical: 20 }} /> : null}
        {!busy && listings.length === 0 ? (
          <Text style={styles.empty}>No listings yet.</Text>
        ) : null}

        {listings.map((l) => (
          <View key={l.id} style={styles.card}>
            <Image
              source={{ uri: (l.images && l.images[0]) || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400' }}
              style={styles.cardImg}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
              <Text style={styles.cardSub}>{naira(l.price)} {l.unit} · {l.quantity} left</Text>
              <Text style={styles.cardSub2}>Category: {l.category}</Text>
              <View style={styles.cardActions}>
                <Pressable onPress={() => router.push({ pathname: '/marketplace-product', params: { id: String(l.id) } } as any)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnTxt}>VIEW</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(l.id)} style={styles.smallBtnDanger}>
                  <Text style={styles.smallBtnDangerTxt}>DELETE</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1, padding: 16, borderRadius: 14,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center',
  },
  statVal: { fontSize: 20, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: p.textMuted, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  addBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  addBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  ordersBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center',
  },
  ordersBtnTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 12 },
  empty: { fontSize: 14, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  card: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10,
  },
  cardImg: { width: 80, height: 80, borderRadius: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  cardSub: { fontSize: 12, color: p.neon, marginTop: 3, fontWeight: '700' },
  cardSub2: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  smallBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
  },
  smallBtnTxt: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  smallBtnDanger: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: p.danger,
  },
  smallBtnDangerTxt: { fontSize: 10, fontWeight: '900', color: p.danger, letterSpacing: 1 },
});
