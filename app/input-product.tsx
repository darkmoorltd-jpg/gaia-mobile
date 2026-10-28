import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { categoryEmoji, categoryLabel } from '../src/data/input_categories';
import ReviewModal from '../src/components/ReviewModal';

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
    try {
      const { data, error } = await supabase.rpc('input_create_order', {
        p_product_id: product.id, p_quantity: q,
        p_delivery_method: delivery,
        p_delivery_address: delivery === 'delivery' ? deliveryAddr.trim() : null,
      });
      if (error) { Alert.alert('Failed', error.message); setBuyBusy(false); return; }
      setOrderId(data.order_id);
      setPayRef(data.reference);
      setTotalNgn(Number(data.total_ngn));
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

        <Text style={styles.section}>SELLER</Text>
        <View style={styles.providerCard}>
          <View style={styles.providerAvatar}><Text style={styles.providerAvatarText}>{(provider?.business_name || 'P').charAt(0)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{provider?.business_name}</Text>
            <Text style={styles.providerMeta}>{provider?.city || provider?.lga}, {provider?.state}</Text>
            {provider?.phone ? <Text style={styles.providerMeta}>📞 {provider.phone}</Text> : null}
          </View>
        </View>

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

        <Pressable onPress={startBuy} disabled={buyBusy} style={[styles.cta, buyBusy && { opacity: 0.5 }]}>
          {buyBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>BUY NOW · {money(total)}</Text>}
        </Pressable>

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
