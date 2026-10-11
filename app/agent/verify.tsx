import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const FEE_KOBO = 200000;
const STATES = ['Kaduna','Kano','Katsina','Niger','Plateau','Bauchi','Zamfara','Sokoto','Jigawa','Kebbi','Kwara','Nasarawa','Benue','FCT Abuja'];
const ID_TYPES = ['National ID Card', "Driver's License", 'International Passport', "Voter's Card (PVC)", 'NIN Slip'];

interface Farmer { user_id: string; name: string; email: string; phone?: string; state?: string; }

function newRef(agentId: string) {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return 'GAIA_VER_' + agentId.slice(0, 8) + '_' + Date.now().toString(36) + r;
}

export default function AgentVerify() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmerId?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selected, setSelected] = useState<Farmer | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    (async () => {
      try {
        const r = await supabase.rpc('agent_my_farmers', { p_filter: 'all', p_search: null, p_limit: 300 });
        const list: Farmer[] = (r.data || []).map((f: any) => ({
          user_id: f.user_id, name: f.name || f.email, email: f.email, phone: f.phone, state: f.state,
        }));
        setFarmers(list);
        if (params.farmerId) {
          const found = list.find((x) => x.user_id === params.farmerId);
          if (found) { setSelected(found); setFullName(found.name); setPhone(found.phone || ''); setState(found.state || 'Kaduna'); }
        }
      } catch {}
      setLoading(false);
    })();
  }, [params.farmerId]);

  const pickImage = async (setter: (v: string) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) setter(res.assets[0].uri);
  };

  const uploadFile = async (uri: string, name: string): Promise<string | null> => {
    try {
      const sess = await supabase.auth.getSession();
      const agentId = sess.data.session?.user?.id;
      if (!agentId) return null;
      const response = await fetch(uri);
      const blob = await response.blob();
      const ab = await new Response(blob).arrayBuffer();
      const path = 'agents/' + agentId + '/' + name + '_' + Date.now() + '.jpg';
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
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLat(loc.coords.latitude); setGpsLng(loc.coords.longitude);
    } catch {}
  };

  const startPayment = async () => {
    if (!selected) { Alert.alert('Pick a farmer first'); return; }
    if (!fullName || !phone || !idImage || !selfie) {
      Alert.alert('Missing', 'Name, phone, ID image, and selfie are required.'); return;
    }
    setBusy(true);
    try {
      const idUrl = await uploadFile(idImage, 'id');
      const selfieUrl = await uploadFile(selfie, 'selfie');
      setUploadedUrls({ id: idUrl, selfie: selfieUrl });

      const sess = await supabase.auth.getSession();
      const agentId = sess.data.session?.user?.id || 'unknown';
      const ref = newRef(agentId);
      setPayRef(ref);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const paystackHTML = () => {
    const email = 'agent.' + (selected?.user_id || 'x').slice(0, 8) + '@gaia.app';
    return `
      <!DOCTYPE html><html><head><meta charset='utf-8'/>
      <script src='https://js.paystack.co/v1/inline.js'></script></head>
      <body style='background:#000;margin:0'>
      <script>
        window.addEventListener('load', function() {
          try {
            var handler = PaystackPop.setup({
              key: '${PAYSTACK_PUBLIC}',
              email: '${email}',
              amount: ${FEE_KOBO},
              currency: 'NGN',
              ref: '${payRef}',
              label: 'GAIA Verification Fee',
              onClose: function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'closed' }));
              },
              callback: function(response) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success', reference: response.reference }));
              }
            });
            handler.openIframe();
          } catch (err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'error', message: String(err) }));
          }
        });
      </script></body></html>
    `;
  };

  const onPaystackMessage = async (raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data.status !== 'success') {
        setPayRef(null);
        if (data.status === 'error') Alert.alert('Payment error', data.message || 'Try again');
        return;
      }
      const reference = data.reference;
      if (!reference || !selected) return;

      setBusy(true);
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      const r = await fetch(API_BASE + '/agent/submit-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          farmer_id: selected.user_id,
          full_name: fullName, phone, state, lga: lga || null, address: address || null,
          bvn: bvn || null, nin: nin || null, id_type: idType, id_number: idNumber || null,
          crop: null, farm_state: state, farm_lga: lga || null, farm_size: null,
          id_image_url: uploadedUrls.id, selfie_url: uploadedUrls.selfie,
          gps_lat: gpsLat, gps_lng: gpsLng,
          payment_reference: reference,
        }),
      });
      const resp = await r.json();
      setBusy(false);
      setPayRef(null);

      if (!r.ok) {
        Alert.alert('Failed', resp.detail || 'Submit failed');
        return;
      }
      Alert.alert(
        'Verification submitted',
        'Paid N2,000. Admin will review shortly. You earn N500 once approved.',
      );
      router.replace('/agent/home' as any);
    } catch (e: any) {
      setBusy(false);
      setPayRef(null);
      Alert.alert('Failed', e.message);
    }
  };

  const filtered = search.trim()
    ? farmers.filter((f) => (f.name + ' ' + f.email + ' ' + (f.phone || '')).toLowerCase().includes(search.toLowerCase()))
    : farmers;

  if (!selected) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Pick a Farmer</Text>
          <Text style={styles.sub}>Search the farmers you registered</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search name, phone, email..." placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" />
          {loading ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}
          {filtered.map((f) => (
            <Pressable key={f.user_id} onPress={() => { setSelected(f); setFullName(f.name); setPhone(f.phone || ''); setState(f.state || 'Kaduna'); }} style={styles.personRow}>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{(f.name || 'U').charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.personMeta} numberOfLines={1}>{(f.phone || 'no phone') + ' · ' + (f.state || 'no state')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          {!loading && filtered.length === 0 ? <View style={styles.empty}><Text style={styles.kv}>No farmers found. Register one first.</Text></View> : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CHANGE FARMER</Text></Pressable>
        <Text style={styles.title}>Verify {selected.name}</Text>
        <Text style={styles.sub}>{selected.email}</Text>

        <Text style={styles.label}>FULL NAME</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>PHONE</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.label}>STATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATES.map((s) => (
            <Pressable key={s} onPress={() => setState(s)} style={[styles.chip, state === s && styles.chipOn]}>
              <Text style={[styles.chipText, state === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>LGA</Text>
        <TextInput value={lga} onChangeText={setLga} style={styles.input} placeholder="e.g. Zaria" placeholderTextColor={palette.textDim} />

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

        <Text style={styles.label}>ID PHOTO</Text>
        <Pressable onPress={() => pickImage(setIdImage)} style={styles.upload}>
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
          <Text style={styles.feeVal}>N2,000</Text>
          <Text style={styles.feeSub}>Submit sends this to admin. You earn N500 on approval.</Text>
        </View>

        <Pressable onPress={startPayment} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>PAY N2,000 & SUBMIT</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!payRef} animationType="slide" onRequestClose={() => setPayRef(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {payRef ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: paystackHTML() }}
              onMessage={(e) => onPaystackMessage(e.nativeEvent.data)}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              style={{ flex: 1, backgroundColor: '#000' }}
            />
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
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
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 16, fontWeight: '900', color: p.neon },
  personName: { fontSize: 14, fontWeight: '800', color: p.text },
  personMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: p.textDim },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginTop: 20 },
  kv: { fontSize: 12, color: p.textMuted },
});
