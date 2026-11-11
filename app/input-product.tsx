import React, { useCallback, useEffect, useState } from 'react';
import { Linking, View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { categoryEmoji, categoryLabel } from '../src/data/input_categories';
import NetInfo from '@react-native-community/netinfo';
import { queueOrder } from '../src/utils/offlineInputs';
import ReviewModal from '../src/components/ReviewModal';
import { walletMe } from '../src/utils/wallet';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function InputProductDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [product, setProduct] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [busy, setBusy] = useState(true);
  const [qty, setQty] = useState('1');
  const [delivery, setDelivery] = useState<'pickup'|'delivery'>('pickup');
  const [deliveryAddr, setDeliveryAddr] = useState('');
  const [payRef, setPayRef] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [totalNgn, setTotalNgn] = useState(0);
  const [buyBusy, setBuyBusy] = useState(false);
  const [reviews, setReviews] = useState<any>({ average: 0, count: 0, reviews: [] });
  const [walletBal, setWalletBal] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || '');
      if (!params.id) { setBusy(false); return; }
      const { data } = await supabase.rpc('input_product_detail', { p_product_id: params.id });
      if (data) { setProduct(data.product); setProvider(data.provider); }
      setBusy(false);
    })();
    (async () => {
      if (!params.id) return;
      const { data: rv } = await supabase.rpc('input_reviews_for_product', { p_product_id: params.id });
      if (rv) setReviews(rv);
    })();

    (async () => {
      try {
        const res = await walletMe();
        setWalletBal(Number(res?.wallet?.balance || 0));
      } catch {}
      setWalletLoading(false);
    })();
  }, [params.id]);

  const computeTotal = () => {
    const q = parseFloat(qty) || 0;
    return Number(product?.price_ngn || 0) * q + (delivery === 'delivery' ? 500 : 0);
  };

  const startBuy = async () => {
    if (!product) return;
    const q = parseFloat(qty) || 0;
    if (q <= 0) { Alert.alert('Quantity must be > 0'); return; }
    if (delivery === 'delivery' && !deliveryAddr.trim()) { Alert.alert('Delivery address required'); return; }
    
    setBuyBusy(true);
    const net = await NetInfo.fetch();

    // OFFLINE QUEUE LOGIC
    if (!net.isConnected) {
      const saved = await queueOrder({
        product_id: product.id, quantity: q,
        delivery_method: delivery,
        delivery_address: delivery === 'delivery' ? deliveryAddr.trim() : null,
      });
      setBuyBusy(false);
      if (saved) {
        Alert.alert('Order Queued!', 'You are offline. This order has been saved and will automatically process the next time you have internet.');
        router.replace('/input-orders' as any);
      } else {
        Alert.alert('Error', 'Could not save order offline.');
      }
      return;
    }

    setBuyBusy(false);
    setShowPin(true); // Show PIN modal instead of immediately buying
  };

  const confirmPinAndBuy = async () => {
    if (!pin || pin.length < 4) { Alert.alert('Enter your 4-digit PIN'); return; }
    const q = parseFloat(qty) || 0;
    setBuyBusy(true);
    try {
      const { data, error } = await supabase.rpc('input_buy_with_wallet_pin', {
        p_product_id: product.id, p_quantity: q,
        p_delivery_method: delivery,
        p_delivery_address: delivery === 'delivery' ? deliveryAddr.trim() : null,
        p_pin: pin
      });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('INVALID_PIN')) {
          Alert.alert('Incorrect PIN', 'Please try again.');
        } else if (msg.includes('INSUFFICIENT_WALLET')) {
          Alert.alert('Insufficient Balance', 'Please top up your wallet from the Home screen, then try again.');
        } else {
          Alert.alert('Failed', msg);
        }
        setBuyBusy(false); return;
      }
      
      Alert.alert('Order Placed!', `₦${Number(data.total_ngn).toLocaleString()} has been held in Escrow. It will be released to the seller once you confirm delivery.`);
      router.replace('/input-orders' as any);
      
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setBuyBusy(false); }
  };

  const onPayMsg = async (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (d.status === 'success' && orderId) {
        await supabase.rpc('input_mark_paid', { p_order_id: orderId, p_reference: d.reference });
        setPayRef(null);
        Alert.alert('Order placed!', 'Provider will confirm and ship soon.');
        router.replace('/input-orders' as any);
      } else if (d.status === 'closed') {
        setPayRef(null);
      }
    } catch {}
  };

  if (busy) return <View style={styles.container}><ActivityIndicator color="#b388ff" style={{ marginTop: 100 }} /></View>;
  if (!product) return <View style={styles.container}><Text style={{ color: palette.text, padding: 20 }}>Product not found.</Text></View>;

  const total = computeTotal();
  // Escrow note
  const payHtml = payRef ? '<html><body style="background:#000;margin:0"><script src="https://js.paystack.co/v1/inline.js"></script><script>PaystackPop.setup({key:"' + PAYSTACK_PUBLIC + '",email:"' + userEmail + '",amount:' + Math.round(totalNgn * 100) + ',currency:"NGN",ref:"' + payRef + '",callback:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({status:"success",reference:r.reference}));},onClose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({status:"closed"}));}}).openIframe();</script></body></html>' : '';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <View style={styles.hero}><Text style={{ fontSize: 64 }}>{categoryEmoji(product.category)}</Text></View>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.sub}>{categoryLabel(product.category)}{product.brand ? ' · ' + product.brand : ''}</Text>
        <Text style={styles.price}>{money(product.price_ngn)} <Text style={styles.unit}>/ {product.unit}</Text></Text>
        <Text style={styles.stock}>{product.quantity_available} {product.unit} in stock</Text>

        {product.description ? (
          <>
            <Text style={styles.section}>ABOUT</Text>
            <Text style={styles.body}>{product.description}</Text>
          </>
        ) : null}

        
        {product?.images && product.images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
            {product.images.map((img: string, i: number) => (
              <Image key={i} source={{ uri: img }} style={{ width: 200, height: 200, borderRadius: 12, marginRight: 10 }} />
            ))}
          </ScrollView>
        ) : null}

        {product?.video_url ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.section}>VIDEO DEMO</Text>
            <WebView source={{ uri: product.video_url }} style={{ height: 220, borderRadius: 12 }} allowsFullscreenVideo />
          </View>
        ) : null}

        {product?.application ? (
          <>
            <Text style={styles.section}>APPLICATION / RECOMMENDATION</Text>
            <View style={{ backgroundColor: 'rgba(179,136,255,0.06)', padding: 16, borderRadius: 12 }}>
              <Text style={styles.body}>{product.application}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.section}>SELLER</Text>
        <Pressable
          onPress={() => router.push(('/input-store?id=' + provider.user_id) as any)}
          style={styles.providerCard}
        >
          <View style={styles.providerAvatar}><Text style={styles.providerAvatarText}>{(provider?.business_name || 'P').charAt(0)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{provider?.business_name}</Text>
            <Text style={styles.providerMeta}>{provider?.city || provider?.lga}, {provider?.state}</Text>
            {provider?.phone ? <Text style={styles.providerMeta}>📞 {provider.phone}</Text> : null}
            <Text style={{ color: '#b388ff', fontSize: 11, fontWeight: '800', marginTop: 6 }}>Tap to view full store →</Text>
          </View>
        </Pressable>

        {provider?.store_images && provider.store_images.length > 0 ? (
          <>
            <Text style={styles.section}>STORE PHOTOS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {provider.store_images.map((img: string, i: number) => (
                <Image key={i} source={{ uri: img }} style={{ width: 200, height: 140, borderRadius: 12 }} />
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.section}>QUANTITY</Text>
        <TextInput value={qty} onChangeText={setQty} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.section}>DELIVERY</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setDelivery('pickup')} style={[styles.chip, delivery === 'pickup' && styles.chipOn]}>
            <Text style={[styles.chipText, delivery === 'pickup' && styles.chipTextOn]}>Pickup</Text>
          </Pressable>
          <Pressable onPress={() => setDelivery('delivery')} style={[styles.chip, delivery === 'delivery' && styles.chipOn]}>
            <Text style={[styles.chipText, delivery === 'delivery' && styles.chipTextOn]}>Delivery (+₦500)</Text>
          </Pressable>
        </View>
        {delivery === 'delivery' ? (
          <TextInput value={deliveryAddr} onChangeText={setDeliveryAddr}
            placeholder="Delivery address" placeholderTextColor={palette.textDim}
            style={[styles.input, { marginTop: 10 }]} />
        ) : null}

        <Text style={styles.section}>RATINGS & REVIEWS</Text>
        <View style={styles.reviewSummary}>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.avgRating}>{reviews.average || '—'}</Text>
            <Text style={{ fontSize: 10, color: palette.textMuted }}>{reviews.count || 0} review{(reviews.count||0) === 1 ? '' : 's'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ color: '#ffd700', fontSize: 20 }}>
              {reviews.count > 0 ? '★'.repeat(Math.round(Number(reviews.average))) + '☆'.repeat(5 - Math.round(Number(reviews.average))) : '☆☆☆☆☆'}
            </Text>
          </View>
        </View>
        {(reviews.reviews || []).slice(0, 5).map((r: any, i: number) => (
          <View key={i} style={styles.reviewCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.reviewAuthor}>{r.reviewer_name}</Text>
              <Text style={{ color: '#ffd700' }}>{'★'.repeat(r.rating)}</Text>
            </View>
            {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
            <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
          </View>
        ))}

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalVal}>{money(total)}</Text>
        </View>

        <View style={{ padding: 12, backgroundColor: 'rgba(179,136,255,0.08)', borderRadius: 8, marginTop: 16 }}>
          <Text style={{ fontSize: 11, color: '#b388ff', textAlign: 'center' }}>
            🔒 Secure Escrow: Your money is held safely. The seller only gets paid after you confirm delivery.
          </Text>
        </View>

        {!walletLoading && walletBal < total ? (
          <View style={{ padding: 14, backgroundColor: 'rgba(255,59,92,0.1)', borderRadius: 10, borderWidth: 1, borderColor: '#ff3b5c', marginTop: 8 }}>
            <Text style={{ color: '#ff3b5c', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>
              Insufficient wallet balance
            </Text>
            <Text style={{ color: p.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
              Need {money(total)} · You have {money(walletBal)}
            </Text>
            <Pressable onPress={() => router.push('/wallet' as any)} style={{ marginTop: 12, paddingVertical: 14, borderRadius: 10, backgroundColor: '#00ff88', alignItems: 'center' }}>
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 }}>TOP UP WALLET</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={startBuy} disabled={buyBusy || walletLoading} style={[styles.cta, (buyBusy || walletLoading) && { opacity: 0.5 }]}>
            {buyBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>PLACE ORDER · {money(total)}</Text>}
          </Pressable>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!payRef} animationType="slide" onRequestClose={() => setPayRef(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable onPress={() => setPayRef(null)} style={{ padding: 16 }}>
            <Text style={{ color: '#b388ff', fontWeight: '900', letterSpacing: 1 }}>CANCEL</Text>
          </Pressable>
          {payRef ? <WebView source={{ html: payHtml }} onMessage={(e) => onPayMsg(e.nativeEvent.data)} javaScriptEnabled domStorageEnabled style={{ flex: 1 }} /> : null}
        </View>
      </Modal>

      <Modal visible={showPin} animationType="slide" transparent onRequestClose={() => setShowPin(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: palette.surface, padding: 24, borderRadius: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: palette.text }}>Enter Wallet PIN</Text>
            <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>To authorize {money(total)}</Text>
            <TextInput
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              style={{ width: '100%', textAlign: 'center', fontSize: 24, letterSpacing: 10, backgroundColor: palette.obsidian, color: palette.text, padding: 16, borderRadius: 12, marginTop: 20 }}
              placeholder="••••"
              placeholderTextColor={palette.textDim}
            />
            <Pressable onPress={confirmPinAndBuy} style={[styles.cta, { width: '100%', marginTop: 20 }]}>
              <Text style={styles.ctaText}>AUTHORIZE PAYMENT</Text>
            </Pressable>
            <Pressable onPress={() => setShowPin(false)} style={{ marginTop: 16 }}>
              <Text style={{ color: palette.textMuted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  hero: { alignItems: 'center', marginVertical: 20 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  price: { fontSize: 28, fontWeight: '900', color: '#b388ff', marginTop: 12 },
  unit: { fontSize: 14, fontWeight: '500', color: p.textMuted },
  stock: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff', marginTop: 24, marginBottom: 8 },
  body: { fontSize: 13, color: p.text, lineHeight: 20 },
  providerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  providerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(179,136,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  providerAvatarText: { fontSize: 20, fontWeight: '900', color: '#b388ff' },
  providerName: { fontSize: 15, fontWeight: '800', color: p.text },
  providerMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: '#b388ff' },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  avgRating: { fontSize: 32, fontWeight: '900', color: '#ffd700' },
  reviewCard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  reviewAuthor: { fontSize: 13, fontWeight: '800', color: p.text },
  reviewText: { fontSize: 12, color: p.text, marginTop: 4, lineHeight: 18 },
  reviewDate: { fontSize: 10, color: p.textDim, marginTop: 4 },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: 'rgba(179,136,255,0.08)', borderWidth: 1, borderColor: 'rgba(179,136,255,0.3)', marginTop: 24 },
  totalLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted },
  totalVal: { fontSize: 24, fontWeight: '900', color: '#b388ff' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: '#b388ff', alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
