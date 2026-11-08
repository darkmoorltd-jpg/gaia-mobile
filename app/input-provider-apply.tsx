import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import LocationCascade from '../src/components/LocationCascade';
import { INPUT_CATEGORIES } from '../src/data/input_categories';

const TIERS = [
  { id: 'starter', name: 'Starter', price: 10000, limit: '5 products' },
  { id: 'growth', name: 'Growth', price: 30000, limit: '20 products' },
  { id: 'enterprise', name: 'Enterprise', price: 75000, limit: 'Unlimited' },
];

export default function InputProviderApply() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [tier, setTier] = useState(TIERS[0]);
  const [businessName, setBusinessName] = useState('');
  const [businessReg, setBusinessReg] = useState('');
  const [phone, setPhone] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState('NG');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [gps, setGps] = useState<{lat: number, lon: number} | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const toggleCategory = (key: string) => {
    setCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const captureGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Location permission required'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setGps({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    Alert.alert('GPS Captured', `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
  };

  const pickImages = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.6,
    });
    if (!res.canceled) {
      setImages(res.assets.map(a => a.uri));
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of images) {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        const path = `store_${Date.now()}_${Math.random().toString(36).slice(2,6)}.jpg`;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        const { error } = await supabase.storage.from('input-store-images').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
        if (!error) {
          const { data } = supabase.storage.from('input-store-images').getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      } catch (e) { console.log('Upload failed', e); }
    }
    return urls;
  };

  const submit = async () => {
    if (!businessName || !phone || categories.length === 0) {
      Alert.alert('Missing', 'Business name, phone, and at least 1 category are required.'); return;
    }
    if (images.length < 3) {
      Alert.alert('Photos Required', 'Please upload at least 3 photos of your shop so admin can verify it.'); return;
    }
    
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please log in first');

      const imageUrls = await uploadImages();

      const { error } = await supabase.rpc('input_provider_apply', {
        p_business_name: businessName.trim(),
        p_address: address || '',
        p_state: state, p_lga: lga, p_city: city, p_country_code: countryCode,
        p_phone: phone, p_whatsapp: phone,
        p_email: user.email,
        p_description: '',
        p_categories: categories,
        p_bank_name: bankName || '',
        p_bank_account_number: bankAccountNumber || '',
        p_bank_account_name: bankAccountName || '',
        p_business_reg_number: businessReg || null,
        p_gps_lat: gps?.lat || null,
        p_gps_lon: gps?.lon || null,
        p_store_images: imageUrls,
      });
      
      if (!error) {
        await supabase.from('input_providers').update({ 
          tier_id: tier.id,
          onboarding_fee_paid: false 
        }).eq('user_id', user.id);
        setDone(true);
      } else {
        Alert.alert('Failed', error.message);
      }
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>✓</Text>
            <Text style={styles.doneTitle}>Application received</Text>
            <Text style={styles.doneBody}>
              Wait for Admin approval. Once approved, log in and go to "My Input Store" to pay your subscription and start listing products.
            </Text>
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.cta}>
              <Text style={styles.ctaText}>BACK TO DASHBOARD</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Sell Farm Inputs</Text>
        
        <Text style={styles.section}>CHOOSE PLAN</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {TIERS.map(t => (
            <Pressable key={t.id} onPress={() => setTier(t)} style={[styles.tierCard, tier.id === t.id && styles.tierCardOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierName}>{t.name}</Text>
                <Text style={styles.tierLimit}>{t.limit}</Text>
              </View>
              <Text style={styles.tierPrice}>₦{t.price.toLocaleString()}/yr</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>BUSINESS DETAILS</Text>
        <Text style={styles.label}>BUSINESS NAME *</Text>
        <TextInput value={businessName} onChangeText={setBusinessName} style={styles.input} placeholder="e.g. Notore Agro Ltd" placeholderTextColor={palette.textDim} />
        <Text style={styles.label}>CAC REG. NUMBER</Text>
        <TextInput value={businessReg} onChangeText={setBusinessReg} style={styles.input} placeholder="RC-1234567" placeholderTextColor={palette.textDim} />
        <Text style={styles.label}>PHONE *</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />
        
        <Text style={styles.label}>WHAT DO YOU SELL? *</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {INPUT_CATEGORIES.map(c => (
            <Pressable key={c.key} onPress={() => toggleCategory(c.key)}
              style={[styles.chip, categories.includes(c.key) && styles.chipOn]}>
              <Text style={[styles.chipText, categories.includes(c.key) && styles.chipTextOn]}>{c.emoji} {c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>BANK & LOCATION</Text>
        <Text style={styles.label}>BANK NAME</Text>
        <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="GTBank" placeholderTextColor={palette.textDim} />
        <Text style={styles.label}>ACCOUNT NUMBER</Text>
        <TextInput value={bankAccountNumber} onChangeText={setBankAccountNumber} keyboardType="number-pad" maxLength={10} style={styles.input} placeholderTextColor={palette.textDim} />
        <Text style={styles.label}>ACCOUNT NAME</Text>
        <TextInput value={bankAccountName} onChangeText={setBankAccountName} style={styles.input} placeholderTextColor={palette.textDim} />

        <Text style={styles.section}>STORE LOCATION & PHOTOS (MIN 3)</Text>
        
        <Pressable onPress={captureGPS} style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={{ color: gps ? palette.neon : palette.textDim }}>
            {gps ? `📍 ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}` : 'Capture Store GPS Location'}
          </Text>
          <Text style={{ fontSize: 18 }}>📍</Text>
        </Pressable>

        <Pressable onPress={pickImages} style={[styles.input, { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={{ color: images.length >= 3 ? palette.neon : palette.textDim }}>
            {images.length > 0 ? `📸 ${images.length} Photo(s) attached` : 'Upload Store Photos (Min 3)'}
          </Text>
          <Text style={{ fontSize: 18 }}>📸</Text>
        </Pressable>
        
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
             {images.map((img, i) => (
               <Image key={i} source={{ uri: img }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
             ))}
          </ScrollView>
        ) : null}

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>SUBMIT APPLICATION</Text>}
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
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff', marginTop: 22, marginBottom: 4 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: '#b388ff' },
  tierCard: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: p.border, alignItems: 'center' },
  tierCardOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.1)' },
  tierName: { fontSize: 16, fontWeight: '900', color: p.text },
  tierLimit: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  tierPrice: { fontSize: 16, fontWeight: '900', color: '#b388ff' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: '#b388ff', alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
  doneBox: { padding: 30, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: '#b388ff', alignItems: 'center', marginTop: 60 },
  doneIcon: { fontSize: 40, fontWeight: '900', color: '#b388ff' },
  doneTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 12 },
  doneBody: { fontSize: 13, color: p.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
