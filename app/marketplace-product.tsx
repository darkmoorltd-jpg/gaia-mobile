import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  fetchListingById, addToCart, naira, getSellerProfile, Listing,
} from '../src/utils/marketplace';
import { displayName } from '../src/utils/friends';

const { width } = Dimensions.get('window');

export default function ProductDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [qty, setQty] = useState(1);

  const load = useCallback(async () => {
    setBusy(true);
    const l = await fetchListingById(params.id);
    setListing(l);
    if (l) {
      const s = await getSellerProfile(l.seller_id);
      setSeller(s);
    }
    setBusy(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const onAdd = async () => {
    if (!user || !listing) return;
    await addToCart(user.id, listing.id, qty);
    Alert.alert('Added to cart', listing.title + ' x' + qty);
  };

  const onBuyNow = async () => {
    if (!user || !listing) return;
    await addToCart(user.id, listing.id, qty);
    router.push('/marketplace-cart' as any);
  };

  const onChat = () => {
    if (!listing) return;
    const sellerName = seller ? displayName(seller) : 'Seller';
    router.push({
      pathname: '/chat-room',
      params: {
        peerId: listing.seller_id,
        peerName: sellerName,
        peerEmail: seller?.email || '',
      },
    } as any);
  };

  if (busy) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: palette.textMuted }}>Listing not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: palette.neon, fontWeight: '800' }}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const image = (listing.images && listing.images[0]) || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800';

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>Product</Text>
        <Pressable onPress={() => router.push('/marketplace-cart' as any)} style={styles.backBtn}>
          <Text style={styles.cartIcon}>C</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: image }} style={styles.hero} />

        <View style={styles.body}>
          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.rating}>★ {listing.rating ? listing.rating.toFixed(1) : '4.5'}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.stock}>
              {listing.quantity > 0 ? 'In stock (' + listing.quantity + ')' : 'Out of stock'}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.loc}>{listing.location || 'Nigeria'}</Text>
          </View>

          <Text style={styles.price}>{naira(listing.price)}</Text>
          <Text style={styles.unit}>{listing.unit}</Text>

          {/* Chat with seller button */}
          <Pressable onPress={onChat} style={styles.chatBtn}>
            <Text style={styles.chatBtnTxt}>💬 Chat with seller (GAIA WhatsApp)</Text>
          </Pressable>

          {/* Seller card */}
          <Text style={styles.sectionLabel}>SELLER</Text>
          <View style={styles.sellerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>
                {(seller ? displayName(seller) : 'S')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>
                {seller ? displayName(seller) : 'Verified Farmer'}
              </Text>
              <Text style={styles.sellerMeta}>
                ✅ Verified · ⭐ {listing.rating ? listing.rating.toFixed(1) : '4.5'}
              </Text>
            </View>
            <Pressable onPress={onChat} style={styles.sellerChatBtn}>
              <Text style={styles.sellerChatTxt}>CHAT</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <Text style={styles.desc}>
            {listing.description || 'No description provided.'}
          </Text>

          <Text style={styles.sectionLabel}>QUANTITY</Text>
          <View style={styles.qtyRow}>
            <Pressable onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn}>
              <Text style={styles.qtyBtnTxt}>-</Text>
            </Pressable>
            <Text style={styles.qtyValue}>{qty}</Text>
            <Pressable onPress={() => setQty(qty + 1)} style={styles.qtyBtn}>
              <Text style={styles.qtyBtnTxt}>+</Text>
            </Pressable>
          </View>

          <View style={styles.escrowNote}>
            <Text style={styles.escrowTxt}>
              🛡️ Escrow protected. Money released to seller only after you confirm delivery.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable onPress={onAdd} style={styles.addCartBtn}>
          <Text style={styles.addCartTxt}>ADD TO CART</Text>
        </Pressable>
        <Pressable onPress={onBuyNow} style={styles.buyNowBtn}>
          <Text style={styles.buyNowTxt}>BUY NOW</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 56, paddingBottom: 10,
    backgroundColor: p.obsidian, borderBottomWidth: 1, borderBottomColor: p.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 32, color: p.text, lineHeight: 32 },
  cartIcon: { fontSize: 14, fontWeight: '900', color: p.neon },
  topTitle: { fontSize: 16, fontWeight: '800', color: p.text },
  scroll: { paddingBottom: 120 },
  hero: { width: '100%', height: 320, backgroundColor: p.surface },
  body: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: p.text, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  rating: { fontSize: 13, color: p.warning, fontWeight: '800' },
  dot: { color: p.textMuted },
  stock: { fontSize: 12, color: p.neon, fontWeight: '700' },
  loc: { fontSize: 12, color: p.textMuted },
  price: { fontSize: 34, fontWeight: '900', color: p.neon, marginTop: 14, letterSpacing: -1 },
  unit: { fontSize: 13, color: p.textMuted, marginTop: 2 },
  chatBtn: {
    marginTop: 16, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: p.borderHi,
    alignItems: 'center',
  },
  chatBtnTxt: { color: p.neon, fontWeight: '800', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  sellerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: p.neonSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 18, fontWeight: '900', color: p.neon },
  sellerName: { fontSize: 15, fontWeight: '700', color: p.text },
  sellerMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  sellerChatBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: p.neon,
  },
  sellerChatTxt: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  desc: { fontSize: 14, color: p.textMuted, lineHeight: 22 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnTxt: { fontSize: 20, color: p.neon, fontWeight: '900' },
  qtyValue: { fontSize: 22, fontWeight: '900', color: p.text, minWidth: 40, textAlign: 'center' },
  escrowNote: {
    marginTop: 20, padding: 14, borderRadius: 12,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.border,
  },
  escrowTxt: { fontSize: 12, color: p.neon, lineHeight: 18 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 8, padding: 14,
    backgroundColor: p.obsidian, borderTopWidth: 1, borderTopColor: p.border,
  },
  addCartBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: p.neon,
    alignItems: 'center',
  },
  addCartTxt: { color: p.neon, fontWeight: '900', letterSpacing: 1, fontSize: 13 },
  buyNowBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12,
    backgroundColor: p.neon, alignItems: 'center',
  },
  buyNowTxt: { color: p.obsidian, fontWeight: '900', letterSpacing: 1, fontSize: 13 },
});
