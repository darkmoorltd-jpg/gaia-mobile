import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';
import Dropdown from '../../src/components/Dropdown';
import { NIGERIA_STATES, lgasForState } from '../../src/data/nigeria_lgas';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const OFFLINE_KEY = 'gaia_offline_farmers_v1';

const CROPS = [
  'Maize', 'Rice', 'Sorghum', 'Millet', 'Cowpea (Beans)', 'Soybean',
  'Groundnut', 'Tomato', 'Pepper', 'Cassava', 'Yam', 'Onion',
  'Cabbage', 'Wheat', 'Cocoa', 'Oil Palm', 'Plantain', 'Banana',
  'Potato', 'Sweet Potato', 'Sesame', 'Ginger', 'Garlic',
  'Watermelon', 'Pineapple',
];

// ============================================================
// Offline queue (sync unsent registrations on app open)
// ============================================================
async function syncOfflineFarmers(token: string) {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_KEY);
    if (!raw) return;
    const queue: any[] = JSON.parse(raw);
    if (!queue.length) return;

    const remaining: any[] = [];
    for (const payload of queue) {
      try {
        const r = await fetch(API_BASE + '/agent/register-farmer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(payload),
        });
        if (!r.ok) remaining.push(payload);
      } catch {
        remaining.push(payload);
      }
    }
    await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  } catch {}
}

export default function AgentRegister() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  useEffect(() => {
    (async () => {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (token) syncOfflineFarmers(token);
    })();
  }, []);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState('Kaduna');
  const [lga, setLga] = useState('');
  const [crop, setCrop] = useState('Maize');
  const [farmSize, setFarmSize] = useState('1');
  const [householdSize, setHouseholdSize] = useState('1');
  const [literacyLevel, setLiteracyLevel] = useState<1|2|3>(3);
  const [educationLevel, setEducationLevel] = useState<0|1|2|3|4>(2);
  const [disability, setDisability] = useState('');
  const [isYouth, setIsYouth] = useState(false);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const captureGps = async () => {
    setGpsBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Permission denied'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
    } catch (e: any) {
      Alert.alert('GPS failed', e.message);
    } finally { setGpsBusy(false); }
  };

  const submit = async () => {
    // Validation
    if (!fullName.trim() || !phone.trim() || !email.trim() || !state.trim()) {
      Alert.alert('Missing info', 'Name, phone, email, and state are required.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Password required', 'Set a password for the farmer (min 6 characters).');
      return;
    }
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      Alert.alert('Invalid DOB', 'Use format YYYY-MM-DD (e.g. 1990-01-15).');
      return;
    }

    setBusy(true);

    const payload = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      password: password.trim(),
      dob: dob || null,
      state: state,
      lga: lga.trim() || null,
      crop: crop,
      farm_size_acres: parseFloat(farmSize) || 1.0,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
    };

    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const r = await fetch(API_BASE + '/agent/register-farmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(data.detail || data.error || ('HTTP ' + r.status));
      }


      // Link farmer to current agent via RPC
      try {
        const linkRes = await supabase.rpc('agent_link_farmer', {
          p_farmer_id: data.farmer_id,
          p_phone: payload.phone,
          p_state: payload.state,
          p_lga: payload.lga,
          p_crop: payload.crop,
          p_farm_size: payload.farm_size_acres,
        });
        if (linkRes.error) console.warn('[agent] link failed:', linkRes.error.message);
        else console.log('[agent] farmer linked:', linkRes.data);
      } catch (e) {
        console.warn('[agent] link exception:', e);
      }

      setResult(data);
    } catch (err: any) {
      // Offline fallback
      if (err.message.includes('Network') || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        try {
          const raw = await AsyncStorage.getItem(OFFLINE_KEY);
          const queue = raw ? JSON.parse(raw) : [];
          queue.push(payload);
          await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
          Alert.alert('Saved Offline', 'No network. This farmer will sync automatically when internet returns.');
          setResult({
            phone: payload.phone,
            email: payload.email,
            temp_password: payload.password,
            offline: true,
          });
        } catch {
          Alert.alert('Error', 'Could not save offline.');
        }
      } else {
        Alert.alert('Failed', err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // ============================================================
  // SUCCESS SCREEN
  // ============================================================
  if (result) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.successTitle}>
            {result.offline ? 'Saved Offline' : 'Farmer registered'}
          </Text>
          <View style={styles.successCard}>
            <Text style={styles.successLbl}>PHONE</Text>
            <Text style={styles.successVal}>{result.phone}</Text>
            <Text style={styles.successLbl}>TEMPORARY PASSWORD</Text>
            <Text style={styles.successVal}>{result.temp_password}</Text>
            <Text style={styles.successLbl}>EMAIL</Text>
            <Text style={styles.successVal}>{result.email}</Text>
          </View>
          <Text style={styles.successHint}>
            {result.offline
              ? 'This record will be uploaded automatically the next time you have internet. Write down the password now.'
              : 'Share the password with the farmer. They can change it after first sign-in.'}
          </Text>
          <Pressable
            onPress={() => {
              setResult(null);
              setFullName(''); setPhone(''); setEmail(''); setDob(''); setPassword('');
              setLga(''); setGpsLat(null); setGpsLng(null);
            }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>REGISTER ANOTHER</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: palette.border, marginTop: 10 }]}
          >
            <Text style={[styles.ctaText, { color: palette.text }]}>BACK TO HOME</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ============================================================
  // FORM
  // ============================================================
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Register Farmer</Text>
        <Text style={styles.sub}>Create a GAIA account on behalf of a farmer</Text>

        <Text style={styles.label}>FULL NAME *</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="e.g. Ibrahim Musa"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>PHONE *</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="08031234567"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>EMAIL *</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="farmer@example.com"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>DATE OF BIRTH (YYYY-MM-DD)</Text>
        <TextInput
          value={dob}
          onChangeText={setDob}
          placeholder="1990-01-15"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>SET FARMER PASSWORD *</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          secureTextEntry
          placeholder="min 6 characters"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />
        <Text style={styles.hint}>Write this down. You will read it to the farmer.</Text>

        <Dropdown
          label="STATE *"
          value={state}
          options={NIGERIA_STATES}
          onChange={(v) => { setState(v); setLga(''); }}
        />

        <Dropdown
          label="LGA"
          value={lga}
          options={lgasForState(state)}
          onChange={setLga}
          placeholder={state ? `Select LGA in ${state}` : 'Pick a state first'}
        />

        <Dropdown
          label="PRIMARY CROP"
          value={crop}
          options={CROPS}
          onChange={setCrop}
        />

        <Text style={styles.label}>FARM SIZE (ACRES)</Text>
        <TextInput
          value={farmSize}
          onChangeText={setFarmSize}
          keyboardType="decimal-pad"
          placeholder="1.5"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>GPS LOCATION</Text>
        <Pressable onPress={captureGps} disabled={gpsBusy} style={[styles.gpsBtn, gpsLat && styles.gpsBtnOn]}>
          {gpsBusy ? (
            <ActivityIndicator color={palette.neon} />
          ) : (
            <Text style={[styles.gpsText, gpsLat && styles.gpsTextOn]}>
              {gpsLat && gpsLng
                ? 'GPS: ' + gpsLat.toFixed(4) + ', ' + gpsLng.toFixed(4)
                : 'CAPTURE GPS LOCATION'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.label}>HOUSEHOLD SIZE</Text>
        <TextInput value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" style={styles.input} placeholder="e.g. 5" />

        <Text style={styles.label}>LITERACY LEVEL</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {[
            { val: 1, label: '1 - Illiterate' },
            { val: 2, label: '2 - Semi' },
            { val: 3, label: '3 - Literate' }
          ].map(opt => (
            <Pressable key={opt.val} onPress={() => setLiteracyLevel(opt.val as 1|2|3)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: literacyLevel === opt.val ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: literacyLevel === opt.val ? '#000' : '#888' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>EDUCATION LEVEL</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[
            { val: 0, label: '0 - None' },
            { val: 1, label: '1 - Primary' },
            { val: 2, label: '2 - Secondary' },
            { val: 3, label: '3 - Tertiary' },
            { val: 4, label: '4 - Other' }
          ].map(opt => (
            <Pressable key={opt.val} onPress={() => setEducationLevel(opt.val as 0|1|2|3|4)} style={{ width: '31%', padding: 12, borderRadius: 8, backgroundColor: educationLevel === opt.val ? '#00ff88' : '#222', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: educationLevel === opt.val ? '#000' : '#888' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>DISABILITY (Optional)</Text>
        <TextInput value={disability} onChangeText={setDisability} style={styles.input} placeholder="e.g. Visual impairment" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Youth (Under 35)</Text>
            <Text style={{ fontSize: 11, color: '#888' }}>Check if the farmer is a youth.</Text>
          </View>
          <Pressable onPress={() => setIsYouth(!isYouth)} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: isYouth ? '#00ff88' : '#333', justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isYouth ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </View>

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? (
            <ActivityIndicator color={palette.obsidian} />
          ) : (
            <Text style={styles.ctaText}>REGISTER FARMER</Text>
          )}
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  hint: { fontSize: 10, color: p.textDim, marginTop: 4, marginBottom: 4, fontStyle: 'italic' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  gpsBtn: { padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  gpsBtnOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.08)' },
  gpsText: { fontSize: 12, fontWeight: '800', color: p.textMuted, letterSpacing: 0.5 },
  gpsTextOn: { color: p.neon },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  successTitle: { fontSize: 26, fontWeight: '900', color: p.text, marginBottom: 20 },
  successCard: { padding: 20, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.neon },
  successLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted, marginTop: 10 },
  successVal: { fontSize: 16, fontWeight: '900', color: p.text, marginTop: 2 },
  successHint: { fontSize: 12, color: p.textMuted, marginTop: 16, lineHeight: 18 },
});
