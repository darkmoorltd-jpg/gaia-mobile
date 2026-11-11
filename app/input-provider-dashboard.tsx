
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { INPUT_CATEGORIES, categoryEmoji } from '../src/data/input_categories';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const TIERS = {
  starter: { name: 'Starter', price: 10000 },
  growth: { name: 'Growth', price: 30000 },
  enterprise: { name: 'Enterprise', price: 75000 },
};
const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function InputProviderDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [provider, setProvider] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [payRef, setPayRef] = useState<string | null>(null);

  // Add product form
  const [name, setName] = useState('');
  const [category, setCategory] = useState(INPUT_CATEGORIES[0]?.key || '');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [stock, setStock] = useState('');
  const [desc, setDesc] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [application, setApplication] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinAction, setPinAction] = useState<'subscribe'|null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prov } = await supabase.from('input_providers').select('*').eq('user_id', user.id).maybeSingle();
      setProvider(prov);
      
      if (prov) {
        const [p, o] = await Promise.all([
          supabase.rpc('input_my_products'),
          supabase.rpc('input_provider_orders'),
        ]);
        setProducts(Array.isArray(p.data) ? p.data : []);
        setOrders(Array.isArray(o.data) ? o.data : []);
      }
    }
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markShipped = (id: string, productName: string) => {
    Alert.alert(
      'Mark as shipped?',
      `Buyer will be notified that "${productName}" is on the way.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'SHIP IT', onPress: async () => {
          const { error } = await supabase.rpc('input_mark_shipped', { p_order_id: id });
          if (error) { Alert.alert('Failed', error.message); return; }
          Alert.alert('Shipped ✅', 'Buyer has been notified.');
          load();
        }},
      ],
    );
  };

  const payWithWallet = () => {
    setPinAction('subscribe');
    setPin('');
    setShowPin(true);
  };

  const confirmPin = async () => {
    if (!pin || pin.length < 4) { Alert.alert('Enter your 4-digit PIN'); return; }
    if (pinAction === 'subscribe') {
      const tierData = TIERS[provider.tier_id as keyof typeof TIERS] || TIERS.starter;
      const { error } = await supabase.rpc('input_pay_subscription_wallet_pin', {
        p_tier: provider.tier_id, p_amount: tierData.price, p_pin: pin
      });
      if (error) Alert.alert('Failed', error.message.includes('INVALID_PIN') ? 'Incorrect PIN' : error.message);
      else { Alert.alert('Subscribed!', 'Your store is now active.'); setShowPin(false); load(); }
    }
  };

  const startPayment = () => {
    if (!provider) return;
    const tierData = TIERS[provider.tier_id as keyof typeof TIERS] || TIERS.starter;
    const ref = 'GAIA_INPUT_' + Date.now().toString(36).toUpperCase();
    setPayRef(ref);
  };

  const onPayMsg = async (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (d.status === 'success' && provider) {
        await supabase.rpc('input_mark_paid', { 
          p_provider_id: provider.id, 
          p_tier_id: provider.tier_id,
          p_payment_ref: d.reference 
        });
        setPayRef(null);
        load();
      } else if (d.status === 'closed') {
        setPayRef(null);
      }
    } catch {}
  };

  const uploadMedia = async (uri: string, folder: string, isVideo: boolean) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const ext = isVideo ? 'mp4' : 'jpg';
      const path = `${provider.user_id}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from('input-product-media').upload(path, bytes.buffer, { contentType: isVideo ? 'video/mp4' : 'image/jpeg' });
      if (error) return null;
      const { data } = supabase.storage.from('input-product-media').getPublicUrl(path);
      return data.publicUrl;
    } catch { return null; }
  };

  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.7,
    });
    if (!res.canceled) {
      const uris = res.assets.map(a => a.uri);
      setImages(prev => [...prev, ...uris.filter(u => u.match(/\.(jpg|jpeg|png|webp)$/i))]);
      const vid = uris.find(u => u.match(/\.(mp4|mov)$/i));
      if (vid) setVideo(vid);
    }
  };

  const addProduct = async () => {
    if (!name || !price || !stock) { Alert.alert('Missing fields'); return; }
    setAdding(true);
    
    // Upload images
    const uploadedImages = [];
    for (const uri of images) {
      const url = await uploadMedia(uri, 'images', false);
      if (url) uploadedImages.push(url);
    }
    // Upload video
    let videoUrl = null;
    if (video) videoUrl = await uploadMedia(video, 'videos', true);

    const { error } = await supabase.rpc('input_add_product', {
      p_name: name.trim(), p_category: category, p_price_ngn: parseFloat(price),
      p_unit: unit, p_quantity_available: parseFloat(stock), p_description: desc.trim() || null,
      p_images: uploadedImages, p_video_url: videoUrl, p_application: application.trim() || null
    });
    setAdding(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setShowAdd(false); setName(''); setPrice(''); setStock(''); setDesc('');
    load();
  };

  if (busy) return <View style={styles.container}><ActivityIndicator color="#b388ff" style={{ marginTop: 100 }} /></View>;

  if (!provider) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff', padding: 20 }}>You are not an input provider yet.</Text>
      </View>
    );
  }

  // PAYWALL STATE
  if (!provider.onboarding_fee_paid) {
    const tierData = TIERS[provider.tier_id as keyof typeof TIERS] || TIERS.starter;
    const payHtml = payRef ? '<html><body style="background:#000;margin:0"><script src="https://js.paystack.co/v1/inline.js"></script><script>PaystackPop.setup({key:"' + PAYSTACK_PUBLIC + '",email:"' + provider.email + '",amount:' + (tierData.price * 100) + ',currency:"NGN",ref:"' + payRef + '",callback:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({status:"success",reference:r.reference}));},onClose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({status:"closed"}));}}).openIframe();</script></body></html>' : '';

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Activate Your Store</Text>
          <Text style={styles.sub}>Your application was approved! Pay your yearly subscription to start listing products.</Text>
          
          <View style={styles.payCard}>
            <Text style={styles.payTier}>{tierData.name} Plan</Text>
            <Text style={styles.payPrice}>₦{tierData.price.toLocaleString()}</Text>
            <Text style={styles.paySub}>per year</Text>
            <Pressable onPress={startPayment} style={styles.cta}>
              <Text style={styles.ctaText}>PAY WITH CARD (PAYSTACK)</Text>
            </Pressable>
            <Pressable onPress={payWithWallet} style={[styles.cta, { backgroundColor: palette.neon, marginTop: 10 }]}>
              <Text style={[styles.ctaText, { color: '#000' }]}>PAY WITH WALLET</Text>
            </Pressable>
          </View>
        </ScrollView>

        <Modal visible={!!payRef} animationType="slide" onRequestClose={() => setPayRef(null)}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Pressable onPress={() => setPayRef(null)} style={{ padding: 16 }}>
              <Text style={{ color: '#b388ff', fontWeight: '900' }}>CANCEL</Text>
            </Pressable>
            {payRef ? <WebView source={{ html: payHtml }} onMessage={(e) => onPayMsg(e.nativeEvent.data)} javaScriptEnabled domStorageEnabled style={{ flex: 1 }} /> : null}
          </View>
        </Modal>

        <Modal visible={showPin} animationType="slide" transparent onRequestClose={() => setShowPin(false)}>
          <View style={styles.modalBg}>
            <View style={[styles.modalSheet, { alignItems: 'center' }]}>
              <Text style={styles.title}>Enter Wallet PIN</Text>
              <Text style={styles.sub}>To authorize this payment</Text>
              <TextInput
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={4}
                style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 10, width: '100%', marginTop: 20 }]}
                placeholder="••••"
                placeholderTextColor={palette.textDim}
              />
              <Pressable onPress={confirmPin} style={[styles.cta, { width: '100%', marginTop: 20 }]}>
                <Text style={styles.ctaText}>AUTHORIZE</Text>
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

  // ACTIVE STATE (Can add products)
  const tierData = TIERS[provider.tier_id as keyof typeof TIERS] || TIERS.starter;
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Text style={styles.title}>{provider.business_name}</Text>
        <Text style={styles.sub}>Status: Active · Plan: {tierData.name}</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>MY PRODUCTS</Text>
          <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ ADD PRODUCT</Text>
          </Pressable>
        </View>

        {products.length === 0 ? <Text style={styles.empty}>No products listed yet.</Text> : null}
        {products.map(p => (
          <View key={p.id} style={styles.card}>
            <Text style={{ fontSize: 24 }}>{categoryEmoji(p.category)}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>{money(p.price_ngn)} / {p.unit} · Stock: {p.quantity_available}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ORDERS FROM BUYERS ({orders.length})</Text>
        {orders.length === 0 ? <Text style={styles.empty}>No orders yet.</Text> : null}
        {orders.map(o => {
          const isEscrow = o.payment_status === 'held_in_escrow';
          const isReleased = o.payment_status === 'released';
          return (
            <View key={o.id} style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.name}>{o.product_name} × {o.quantity}</Text>
                <Text style={{ fontSize: 10, fontWeight: '900', color: isReleased ? '#00ff88' : '#ffb300' }}>
                  {isReleased ? 'PAID OUT' : 'IN ESCROW'}
                </Text>
              </View>
              
              <Text style={[styles.total, { marginTop: 10 }]}>{money(o.total_ngn)}</Text>
              
              {o.status === 'pending' && o.payment_status === 'held_in_escrow' ? (
                <Pressable
                  onPress={() => markShipped(o.id, o.product_name)}
                  style={{ marginTop: 10, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4fc3f7', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1 }}>
                    🚚 MARK AS SHIPPED
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Text style={styles.title}>Add New Product</Text>
            <Text style={styles.label}>PRODUCT NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>CATEGORY</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
              {INPUT_CATEGORIES.map(c => (
                <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipOn]}>
                  <Text style={[styles.chipText, category === c.key && styles.chipTextOn]}>{c.emoji} {c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>PRICE (₦)</Text>
            <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>UNIT</Text>
            <TextInput value={unit} onChangeText={setUnit} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>QUANTITY</Text>
            <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            
            <Text style={styles.label}>APPLICATION / RECOMMENDATIONS</Text>
            <TextInput value={application} onChangeText={setApplication} multiline style={[styles.input, { height: 80 }]} placeholder="How to use this product (e.g., 2 bags per hectare)" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>PRODUCT MEDIA (UP TO 20 IMAGES + 1 VIDEO)</Text>
            <Pressable onPress={pickMedia} style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              <Text style={{ color: images.length > 0 || video ? '#b388ff' : palette.textDim }}>
                {images.length} Image(s) · {video ? '1 Video' : 'No Video'}
              </Text>
              <Text>📸</Text>
            </Pressable>

            <Pressable onPress={addProduct} disabled={adding} style={styles.cta}>
              {adding ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>SAVE PRODUCT</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showPin} animationType="slide" transparent onRequestClose={() => setShowPin(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { alignItems: 'center' }]}>
            <Text style={styles.title}>Enter Wallet PIN</Text>
            <Text style={styles.sub}>To authorize this payment</Text>
            <TextInput
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 10, width: '100%', marginTop: 20 }]}
              placeholder="••••"
              placeholderTextColor={palette.textDim}
            />
            <Pressable onPress={confirmPin} style={[styles.cta, { width: '100%', marginTop: 20 }]}>
              <Text style={styles.ctaText}>AUTHORIZE</Text>
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
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#b388ff', borderRadius: 8 },
  addBtnText: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1 },
  empty: { fontSize: 12, color: p.textMuted, marginTop: 10, fontStyle: 'italic' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  total: { fontSize: 16, fontWeight: '900', color: '#b388ff', marginTop: 4 },
  payCard: { backgroundColor: p.surface, padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#b388ff', marginTop: 20 },
  payTier: { fontSize: 16, fontWeight: '800', color: p.text },
  payPrice: { fontSize: 40, fontWeight: '900', color: '#b388ff', marginTop: 10 },
  paySub: { fontSize: 12, color: p.textMuted },
  cta: { padding: 16, borderRadius: 12, backgroundColor: '#b388ff', alignItems: 'center', marginTop: 24, width: '100%' },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: '#b388ff' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  modalSheet: { backgroundColor: p.abyss, marginTop: 60, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
