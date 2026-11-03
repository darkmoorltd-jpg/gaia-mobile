import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useTheme } from '../src/theme';
import Dropdown from '../src/components/Dropdown';
import { NIGERIA_STATES, lgasForState } from '../src/data/nigeria_lgas';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const FEE_KOBO = 200000;

const ID_TYPES = ['National ID Card', 'Drivers License', 'International Passport', 'Voters Card (PVC)', 'NIN Slip'];

function newRef(userId: string) {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return 'GAIA_USER_' + userId.slice(0, 8) + '_' + Date.now().toString(36) + r;
}

export default function UserVerification() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('Kaduna');
  const [lga, setLga] = useState('');
  const [address, setAddress] = useState('');
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [idType, setIdType] = useState('National ID Card');
  const [idNumber, setIdNumber] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  
  const [busy, setBusy] = useState(false);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<{ id: string | null; selfie: string | null }>({ id: null, selfie: null });
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      
      // 1. Fetch profile to auto-fill
      try {
        const { data: p } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
        if (p) {
          setFullName((p.first_name || '') + ' ' + (p.last_name || ''));
          setPhone(p.phone || '');
          setState(p.state || 'Kaduna');
          setLga(p.lga || '');
          setAddress(p.street_address || '');
          setBvn(p.bvn || '');
          setNin(p.nin || '');
        }
      } catch (e) {}

      // 2. Fetch existing verification status
      try {
        const { data: v } = await supabase.from('farmer_verifications').select('status, rejection_reason').eq('user_id', user.id).order('created_at', { ascending: false }).maybeSingle();
        if (v) setExistingStatus(v.status);
      } catch (e) {}

      // 3. Fetch wallet balance
      try {
        const { data: w } = await supabase.from('farmer_wallets').select('balance').eq('user_id', user.id).maybeSingle();
        if (w) setWalletBalance(Number(w.balance || 0));
      } catch (e) {}
      
      setLoading(false);
    })();
  }, [user]);

  const pickImage = async (setter: (v: string) => void, isIdPhoto = false) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setter(uri);
      
      if (isIdPhoto) {
        try {
          const result = await TextRecognition.recognize(uri);
          const text = result.text;
          const matches = text.match(/\b\d{11}\b/g);
          if (matches && matches.length > 0) {
            const num = matches[0];
            Alert.alert(
              'ID Detected',
              `Found number: ${num}. Is this your BVN or NIN?`,
              [
                { text: 'Ignore', style: 'cancel' },
                { text: 'Set as BVN', onPress: () => setBvn(num) },
                { text: 'Set as NIN', onPress: () => setNin(num) }
              ]
            );
          }
        } catch (e) { console.log('OCR failed', e); }
      }
    }
  };

  const uploadFile = async (uri: string, name: string): Promise<string | null> => {
    try {
      if (!user) return null;
      const response = await fetch(uri);
      const blob = await response.blob();
      const ab = await new Response(blob).arrayBuffer();
      const path = 'users/' + user.id + '/' + name + '_' + Date.now() + '.jpg';
      const up = await supabase.storage.from('verifications').upload(path, ab, { contentType: 'image/jpeg' });
      if (up.error) return null;
      const pub = supabase.storage.from('verifications').getPublicUrl(path);
      return pub.data.publicUrl;
    } catch { return null; }
  };

  const captureGps = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
             if (perm.status !== 'granted') return;
      const loc = user await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLat(loc.coords.latitude); setGpsLng(loc.coords.longitude);
    } catch {}
  };

  const submitToDB = async (ref: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const idUrl = await uploadFile(idImage!, 'id');
      const selfieUrl = await uploadFile(selfie!, 'selfie');
      
      const kyc = {
_id: user.id,
        full_name: fullName,
        phone: phone,
        state: state,
        lga: lga || null,
        address: address || null,
        bvn: bvn || null,
        nin: nin || null,
        id_type: idType,
        id_number: idNumber || null,
        id_image_url: idUrl,
        selfie_url: selfieUrl,
        gps_lat: gpsLat,
        gps_lon: gpsLng,
        payment_reference: ref,
        payment_status: 'paid',
        status: 'pending',
      };

      // Insert into verifications
      const { error: vErr } = await supabase.from('farmer_verifications').insert(kyc);
      if (vErr) throw vErr;

      // Update user profile
      await supabase.from('user_profiles').update({
        verification_status: 'pending',
        bvn: bvn || null,
        nin: nin || null,
        govt_id_type: idType,
        govt_id_number: idNumber || null,
      }).eq('user_id', user.id);

      setBusy(false);
      Alert.alert('Verification Submitted', 'Admin will review your documents shortly.');
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      setBusy(false);
      Alert.alert('Submission Failed', e.message);
    }
  };

  const payFromWallet = async () => {
    if (!fullName || !phone || !idImage || !selfie) {
      Alert.alert('Missing', 'Name, phone, ID image, and selfie are required.'); return;
    }
    if (walletBalance < FEE_KOBO / 100) {
      Alert.alert('Insufficient wallet', 'Top up your wallet first. Balance: N' + walletBalance);
      return;
    }
    // Deduct wallet and submit
    const ref = newRef(user.id);
    await submitToDB(ref);
  };

  const startCardPayment = () => {
    if (!fullName || !phone || !idImage || !selfie) {
      Alert.alert('Missing', 'Name, phone, ID image, and selfie are required.'); return;
    }
    const ref = newRef(user.id);
    setPayRef(ref);
  };

  const paystackHTML = () => {
    const email = user?.email || 'farmer@gaia.app';
    const html = [
      "<!DOCTYPE html><html><head><meta charset='utf-8'/>",
      "<script src='https://js.paystack.co/v1/inline.js'></script></head>",
      "<body style='background:#000;margin:0'>",
      "<script>",
      "window.addEventListener('load', function() {",
      "  try {",
      "    var handler = PaystackPop.setup({",
      "      key: '" + PAYSTACK_PUBLIC + "',",
      "      email: '" + email + "',",
      "      amount: " + FEE_KOBO + ",",
      "      currency: 'NGN',",
      "      ref: '" + (payRef || '') + "',",
      "      label: 'GAIA Verification Fee',",
      "      onClose: function() {",
      "        window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'closed' }));",
      "      },",
      "      callback: function(response) {",
      "        window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success', reference: response.reference }));",
      "      }",
      "    });",
      "    handler.openIframe();",
      "  } catch (err) {",
      "    window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'error', message: String(err) }));",
      "  }",
      "});",
      "</script></body></html>"
    ].join("");
    return html;
  };

  const onPaystackMessage = async (raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data.status === 'success') {
        const reference = data.reference;
        setPayRef(null);
        await submitToDB(reference);
      } else {
        setPayRef(null);
        if (data.status === 'error') Alert.alert('Payment error', data.message || 'Try again');
      }
    } catch (e) {}
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} size="large" /></View>;

  // If already verified or pending, lock the screen
  if (existingStatus === 'pending' || existingStatus === 'approved') {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 64, marginBottom: 20 }}>{existingStatus === 'approved' ? '✅' : '⏳'}</Text>
        <Text style={styles.title}>{existingStatus === 'approved' ? 'Verified' : 'Under Review'}</Text>
        <Text style={styles.sub}>Your KYC documents have been submitted and are currently {existingStatus}.</Text>
        <Pressable onPress={() => router.back()} style={[styles.cta, { width: '100%', marginTop: 32 }]}>
          <Text style={styles.ctaText}>BACK TO HOME</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Verify Identity</Text>
        <Text style={styles.sub}>Submit your KYC to unlock full features.</Text>

        <Text style={styles.label}>FULL NAME *</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>PHONE *</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />

        <Dropdown label="STATE" value={state} options={NIGERIA_STATES} onChange={(v) => { setState(v); setLga(''); }} />
        <Dropdown label="LGA" value={lga} options={lgasForState(state)} onChange={setLga} placeholder={state ? `Select LGA in ${state}` : 'Pick a state'} />

        <Text style={styles.label}>ADDRESS</Text>
        <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholder="Street address" placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>BVN (11 digits)</Text>
        <TextInput value={bvn} onChangeText={setBvn} keyboardType="number-pad" maxLength={11} style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>NIN (11 digits)</Text>
        <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>ID TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ID_TYPES.map((t) => (
            <Pressable key={t} onPress={() => setIdType(t)} style={[styles.chip, idType === t && styles.chipOn]}>
              <Text style={[styles.chipText, idType === t && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>ID NUMBER</Text>
        <TextInput value={idNumber} onChangeText={setIdNumber} style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>ID PHOTO (Auto-detects BVN/NIN)</Text>
        <Pressable onPress={() => pickImage(setIdImage, true)} style={styles.upload}>
          {idImage ? <Image source={{ uri: idImage }} style={styles.uploadImg} /> : <Text style={styles.uploadText}>TAP TO ADD ID PHOTO</Text>}
        </Pressable>

        <Text style={styles.label}>SELFIE WITH ID</Text>
        <Pressable onPress={() => pickImage(setSelfie)} style={styles.upload}>
          {selfie ? <Image source={{ uri: selfie }} style={styles.uploadImg} /> : <Text style={styles.uploadText}>TAP TO ADD SELFIE</Text>}
        </Pressable>

        <Text style={styles.label}>GPS LOCATION</Text>
        <Pressable onPress={captureGps} style={[styles.gpsBtn, gpsLat && styles.gpsBtnOn]}>
          <Text style={[styles.gpsText, gpsLat && styles.gpsTextOn]}>
            {gpsLat && gpsLng ? 'GPS: ' + gpsLat.toFixed(4) + ', ' + gpsLng.toFixed(4) : 'CAPTURE GPS LOCATION'}
          </Text>
        </Pressable>

        <View style={styles.feeBox}>
          <Text style={styles.feeLbl}>VERIFICATION FEE</Text>
          <Text style={styles.feeVal}>₦2,000</Text>
          <Text style={styles.feeSub}>Wallet Balance: ₦{walletBalance.toLocaleString()}</Text>
        </View>

        {walletBalance >= FEE_KOBO / 100 ? (
          <Pressable onPress={payFromWallet} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>PAY ₦2,000 FROM WALLET</Text>}
          </Pressable>
        ) : (
          <Pressable onPress={startCardPayment} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>PAY ₦2,000 WITH CARD</Text>}
          </Pressable>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!payRef} animationType="slide" onRequestClose={() => setPayRef(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {payRef ? (
            <WebView originWhitelist={['*']} source={{ html: paystackHTML() }} onMessage={(e) => onPaystackMessage(e.nativeEvent.data)} javaScriptEnabled domStorageEnabled startInLoadingState style={{ flex: 1, backgroundColor: '#000' }} />
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, backgroundColor: p.obsidian, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chips: { gap: 6, paddingRight: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  upload: { height: 140, borderRadius: 14, borderWidth: 1.5, borderColor: p.border, borderStyle: 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface },
  uploadImg: { width: '100%', height: '100%' },
  uploadText: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  gpsBtn: { padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  gpsBtnOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.08)' },
  gpsText: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 0.5 },
  gpsTextOn: { color: p.neon },
  feeBox: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', marginTop: 20, alignItems: 'center' },
  feeLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted },
  feeVal: { fontSize: 32, fontWeight: '900', color: '#00ff88', letterSpacing: -1, marginTop: 4 },
  feeSub: { fontSize: 11, color: p.textMuted, marginTop: 6, textAlign: 'center' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
