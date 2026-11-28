import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export default function AgentRegister() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  // ── Personal ──
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');

  // ── Location ──
  const [stateName, setStateName] = useState('Kaduna');
  const [lga, setLga] = useState('');
  const [ward, setWard] = useState('');
  const [community, setCommunity] = useState('');

  // ── Identity ──
  const [nin, setNin] = useState('');
  const [ninVerified, setNinVerified] = useState(false);
  const [verifyingNin, setVerifyingNin] = useState(false);
  const [portraitPhoto, setPortraitPhoto] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  // ── Consent ──
  const [ndpaConsent, setNdpaConsent] = useState(false);

  // ── UI state ──
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const pickPhoto = async (setter: (v: string) => void, camera = true) => {
    const r = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const uploadPhoto = async (uri: string, farmerId: string, folder: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const path = farmerId + '/' + folder + '-' + Date.now() + '.jpg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from('farmer-assets').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
      if (error) return null;
      const { data } = supabase.storage.from('farmer-assets').createSignedUrl(path, 60 * 60 * 24 * 365);
      return data?.signedUrl || null;
    } catch { return null; }
  };

  const verifyNIN = async () => {
    if (!nin || nin.length < 11) { Alert.alert('Invalid NIN', 'NIN must be 11 digits'); return; }
    setVerifyingNin(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      const res = await fetch(API_BASE + '/verify-nin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ nin, first_name: fullName.split(' ')[0], last_name: fullName.split(' ')[1] || '' }),
      });
      const data = await res.json();
      if (data.verified) {
        setNinVerified(true);
        Alert.alert('Success', 'NIN verified against NIMC records.');
      } else {
        Alert.alert('Failed', data.detail || 'Could not verify NIN');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setVerifyingNin(false); }
  };

  const submit = async () => {
    if (!fullName.trim() || !phone.trim()) { Alert.alert('Missing', 'Name and phone required.'); return; }
    if (!password || password.length < 6) { Alert.alert('Password', 'Min 6 characters.'); return; }
    if (!stateName.trim() || !lga.trim()) { Alert.alert('Missing', 'State and LGA required.'); return; }
    if (!nin || nin.length !== 11) { Alert.alert('NIN', '11-digit NIN required.'); return; }
    if (!portraitPhoto) { Alert.alert('Required', 'Farmer portrait required.'); return; }
    if (!idPhoto) { Alert.alert('Required', 'Government ID photo required.'); return; }
    if (!ndpaConsent) { Alert.alert('Consent Required', 'You must confirm the NDPA consent.'); return; }

    setBusy(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // 1. Create farmer auth user via external API
      const r = await fetch(API_BASE + '/agent/register-farmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          password: password.trim(),
          state: stateName.trim(),
          lga: lga.trim() || null,
          crop: null,
          farm_size_acres: null,
          gps_lat: null,
          gps_lng: null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || 'HTTP ' + r.status);

      // 2. Upload identity photos
      let portraitUrl: string | null = null;
      let idUrl: string | null = null;
      if (data.farmer_id) {
        await new Promise(res => setTimeout(res, 400));
        [portraitUrl, idUrl] = await Promise.all([
          uploadPhoto(portraitPhoto, data.farmer_id, 'portrait'),
          uploadPhoto(idPhoto, data.farmer_id, 'id'),
        ]);
      }

      // 3. Write identity to farmer_registry (farm fields intentionally null)
      const { error: rpcErr } = await supabase.rpc('agent_complete_farmer_registration', {
        p_farmer_user_id: data.farmer_id,
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_state: stateName.trim(),
        p_lga: lga.trim() || null,
        p_ward: ward.trim() || null,
        p_farmer_category: null,
        p_farmer_subcategory: null,
        p_farm_size_acres: null,
        p_gps_lat: null,
        p_gps_lng: null,
        p_data: {
          community: community.trim() || null,
          date_of_birth: dob || null,
          sex: sex || null,
          nin: nin,
          nin_verified: ninVerified,
          farmer_portrait_url: portraitUrl,
          id_document_url: idUrl,
          ndpa_consent: true,
        },
      });
      if (rpcErr) throw rpcErr;

      setResult(data);
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setBusy(false); }
  };

  if (result) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.successTitle}>Farmer Registered ✅</Text>
          <Text style={styles.successSub}>Next: visit the farm and tap VERIFY FARMER</Text>
          <View style={styles.successCard}>
            <Text style={styles.successLbl}>PHONE</Text>
            <Text style={styles.successVal}>{result.phone}</Text>
            <Text style={styles.successLbl}>TEMP PASSWORD</Text>
            <Text style={styles.successVal}>{result.temp_password || '—'}</Text>
          </View>
          <Pressable onPress={() => {
            setResult(null); setFullName(''); setPhone(''); setEmail(''); setPassword('');
            setDob(''); setSex(''); setLga(''); setWard(''); setCommunity('');
            setNin(''); setNinVerified(false); setPortraitPhoto(null); setIdPhoto(null);
          }} style={styles.cta}>
            <Text style={styles.ctaText}>REGISTER ANOTHER</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/verify' as any)} style={[styles.cta, { backgroundColor: '#3b82f6', marginTop: 12 }]}>
            <Text style={styles.ctaText}>GO TO VERIFY FARMER</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Register Farmer</Text>
        <Text style={styles.sub}>Step 1 of 2 — Identity only. Farm details captured separately.</Text>

        <Text style={styles.sectionLabel}>PERSONAL</Text>
        <Text style={styles.label}>FULL NAME *</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholderTextColor="#888" placeholder="First Last" />
        <Text style={styles.label}>PHONE *</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor="#888" />
        <Text style={styles.label}>EMAIL (optional)</Text>
        <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor="#888" />
        <Text style={styles.label}>PASSWORD * (min 6)</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholderTextColor="#888" />
        <Text style={styles.label}>DATE OF BIRTH</Text>
        <TextInput value={dob} onChangeText={setDob} placeholder="1990-01-15" placeholderTextColor="#888" style={styles.input} />
        <Text style={styles.label}>SEX</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {['male', 'female', 'other'].map(opt => (
            <Pressable key={opt} onPress={() => setSex(opt)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: sex === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: sex === opt ? '#000' : '#888', textTransform: 'uppercase' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>LOCATION</Text>
        <Text style={styles.label}>STATE *</Text>
        <TextInput value={stateName} onChangeText={setStateName} style={styles.input} placeholderTextColor="#888" />
        <Text style={styles.label}>LGA *</Text>
        <TextInput value={lga} onChangeText={setLga} style={styles.input} placeholderTextColor="#888" />
        <Text style={styles.label}>WARD</Text>
        <TextInput value={ward} onChangeText={setWard} style={styles.input} placeholderTextColor="#888" />
        <Text style={styles.label}>COMMUNITY</Text>
        <TextInput value={community} onChangeText={setCommunity} style={styles.input} placeholderTextColor="#888" placeholder="Village / community name" />

        <Text style={styles.sectionLabel}>IDENTITY</Text>
        <Text style={styles.label}>NIN (11 digits) *</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11}
            style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholderTextColor="#888" />
          <Pressable onPress={verifyNIN} disabled={verifyingNin || ninVerified}
            style={{ backgroundColor: ninVerified ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 }}>
            {verifyingNin ? <ActivityIndicator color="#00ff88" /> :
              <Text style={{ color: '#00ff88', fontWeight: '900' }}>{ninVerified ? '✅ VERIFIED' : 'VERIFY'}</Text>}
          </Pressable>
        </View>

        <Text style={styles.label}>FARMER PORTRAIT *</Text>
        <Pressable onPress={() => pickPhoto(setPortraitPhoto)} style={[styles.photoBtn, portraitPhoto && styles.photoBtnFilled]}>
          {portraitPhoto
            ? <Image source={{ uri: portraitPhoto }} style={{ width: '100%', height: 140, borderRadius: 10 }} />
            : <Text style={styles.photoTxt}>📸 TAKE PORTRAIT (face)</Text>}
        </Pressable>

        <Text style={styles.label}>GOVERNMENT ID PHOTO *</Text>
        <Pressable onPress={() => pickPhoto(setIdPhoto)} style={[styles.photoBtn, idPhoto && styles.photoBtnFilled]}>
          {idPhoto
            ? <Image source={{ uri: idPhoto }} style={{ width: '100%', height: 140, borderRadius: 10 }} />
            : <Text style={styles.photoTxt}>📸 TAKE ID DOCUMENT</Text>}
        </Pressable>

        <View style={{ marginTop: 24, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: '#333' }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#00ff88', letterSpacing: 1.5, marginBottom: 10 }}>
            DATA PROTECTION & CONSENT (NDPA 2023)
          </Text>
          <Pressable onPress={() => setNdpaConsent(!ndpaConsent)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: ndpaConsent ? '#00ff88' : '#888', backgroundColor: ndpaConsent ? '#00ff88' : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              {ndpaConsent ? <Text style={{ fontSize: 14, fontWeight: '900', color: '#000' }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 12, color: '#ccc', lineHeight: 18, flex: 1 }}>
              The farmer has given explicit consent to GAIA to collect, process, and share their identity data, GPS, and farm information for agricultural services, per the Nigeria Data Protection Act 2023.
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>REGISTER & CONTINUE TO VERIFY</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15, marginBottom: 10 },
  photoBtn: { padding: 20, borderRadius: 12, borderWidth: 1.5, borderColor: '#00ff88', borderStyle: 'dashed', alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(0,255,136,0.05)' },
  photoBtnFilled: { borderStyle: 'solid', padding: 4 },
  photoTxt: { color: '#00ff88', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  successTitle: { fontSize: 26, fontWeight: '900', color: p.text, marginBottom: 8, textAlign: 'center', marginTop: 20 },
  successSub: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginBottom: 20 },
  successCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 20 },
  successLbl: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginTop: 8 },
  successVal: { fontSize: 18, fontWeight: '900', color: p.text, marginTop: 4 },
});
