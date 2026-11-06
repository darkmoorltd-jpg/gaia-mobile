import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';

const TIERS = [
  { id: 'starter', name: 'Starter', price: 25000, commission: '15%', features: 'Basic store · 5 products' },
  { id: 'growth', name: 'Growth', price: 75000, commission: '12%', features: 'Featured store · 20 products' },
  { id: 'enterprise', name: 'Enterprise', price: 250000, commission: '10%', features: 'Top of search · Unlimited products' },
];

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function OrganicSellerRegister() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [businessName, setBusinessName] = useState('');
  const [cac, setCac] = useState('');
  const [state, setState] = useState('Lagos');
  const [lga, setLga] = useState('');
  const [address, setAddress] = useState('');
  const [selectedTier, setSelectedTier] = useState(TIERS[0]);
  const [busy, setBusy] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payRef, setPayRef] = useState('');

  const startPayment = () => {
    if (!businessName.trim() || !address.trim() || !lga.trim()) {
      Alert.alert('Missing Info', 'Please fill business name, LGA, and farm address.');
      return;
    }
    const ref = 'GAIA_ORG_' + Date.now().toString(36).toUpperCase();
    setPayRef(ref);
    setShowPay(true);
  };

  const onPayMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.status === 'success') {
        setBusy(true);
        // Register seller in DB
        const { error } = await supabase.rpc('register_organic_seller', {
          p_business_name: businessName.trim(),
          p_tier_id: selectedTier.id,
          p_cac: cac.trim() || null,
          p_state: state,
          p_lga: lga.trim(),
          p_address: address.trim(),
        });

        setBusy(false);
        setShowPay(false);
        if (error) {
          Alert.alert('Registration Failed', error.message);
        } else {
          Alert.alert('Welcome to GAIA Organic!', 'Your store is now active. Start adding products.');
          router.replace('/organic-seller-dashboard' as any);
        }
      } else if (msg.status === 'closed') {
        setShowPay(false);
        Alert.alert('Payment Cancelled');
      }
    } catch (e) { console.log('pay parse', e); }
  };

  const payHtml = `
    <html><body style="margin:0;background:#000;">
    <script src="https://js.paystack.co/v1/inline.js"></script>
    <script>
      PaystackPop.setup({
        key: '${PAYSTACK_PUBLIC}',
        email: '${user?.email}',
        amount: ${selectedTier.price * 100},
        currency: 'NGN',
        ref: '${payRef}',
        label: 'GAIA Organic ${selectedTier.name}',
        callback: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'success', reference: response.reference}));
        },
        onClose: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'}));
        }
      }).openIframe();
    </script></body></html>`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Become an Organic Seller</Text>
        <Text style={styles.sub}>Reach thousands of buyers and diaspora customers.</Text>

        <Text style={styles.sectionLabel}>SELECT YOUR PLAN</Text>
        <View style={styles.tierRow}>
          {TIERS.map(t => (
            <Pressable key={t.id} onPress={() => setSelectedTier(t)} style={[styles.tierCard, selectedTier.id === t.id && styles.tierCardActive]}>
              <Text style={styles.tierName}>{t.name}</Text>
              <Text style={styles.tierPrice}>₦{t.price.toLocaleString()}</Text>
              <Text style={styles.tierSub}>/ year</Text>
              <Text style={styles.tierComm}>{t.commission} commission</Text>
              <Text style={styles.tierFeatures}>{t.features}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>BUSINESS INFO</Text>
        <Text style={styles.label}>BUSINESS / FARM NAME *</Text>
        <TextInput value={businessName} onChangeText={setBusinessName} style={styles.input} placeholder="e.g. Green Acres Organics" placeholderTextColor={palette.textDim} />
        
        <Text style={styles.label}>CAC REGISTRATION (optional)</Text>
        <TextInput value={cac} onChangeText={setCac} style={styles.input} placeholder="RC-1234567" placeholderTextColor={palette.textDim} autoCapitalize="characters" />

        <Text style={styles.label}>STATE *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
          {STATES.map(s => (
            <Pressable key={s} onPress={() => setState(s)} style={[styles.chip, state === s && styles.chipOn]}>
              <Text style={[styles.chipText, state === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>LGA *</Text>
        <TextInput value={lga} onChangeText={setLga} style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>FARM ADDRESS *</Text>
        <TextInput value={address} onChangeText={setAddress} multiline style={[styles.input, { minHeight: 60 }]} placeholderTextColor={palette.textDim} />

        <Pressable onPress={startPayment} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>PAY ₦{selectedTier.price.toLocaleString()} & OPEN STORE</Text>}
        </Pressable>
        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={showPay} animationType="slide" onRequestClose={() => setShowPay(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable onPress={() => setShowPay(false)} style={{ padding: 16 }}>
            <Text style={{ color: '#00ff88', fontWeight: '900' }}>CANCEL</Text>
          </Pressable>
          {payHtml ? <WebView source={{ html: payHtml }} onMessage={onPayMessage} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled /> : null}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 12 },
  tierRow: { flexDirection: 'row', gap: 8 },
  tierCard: { flex: 1, backgroundColor: p.surface, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: p.border, alignItems: 'center' },
  tierCardActive: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.1)' },
  tierName: { fontSize: 14, fontWeight: '900', color: p.text },
  tierPrice: { fontSize: 18, fontWeight: '900', color: p.neon, marginTop: 4 },
  tierSub: { fontSize: 9, color: p.textMuted },
  tierComm: { fontSize: 10, fontWeight: '800', color: '#ffb300', marginTop: 8 },
  tierFeatures: { fontSize: 9, color: p.textDim, textAlign: 'center', marginTop: 4 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
