import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { walletMe } from '../src/utils/wallet';

const PLANS = [
  { id: 'small', name: 'Small', month: 2500, year: 25000, desc: 'Up to 10 listings' },
  { id: 'medium', name: 'Medium', month: 5000, year: 50000, desc: 'Up to 50 listings' },
  { id: 'large', name: 'Large', month: 10000, year: 100000, desc: 'Unlimited listings' },
  { id: 'commercial', name: 'Commercial', month: 25000, year: 250000, desc: 'B2B / Wholesale' },
];

export default function RentStore() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [plan, setPlan] = useState('small');
  const [cycle, setCycle] = useState<'monthly'|'annual'>('monthly');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(0);
  const [coords, setCoords] = useState<{lat: number, lon: number} | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const w = await walletMe();
      if (w) setBalance(Number(w.wallet.balance || 0));
    })();
  }, []);

  const uploadFile = async (uri: string, mime: string, folder: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
    const ext = mime.includes('pdf') ? 'pdf' : 'jpg';
    const path = user!.id + '/' + folder + '-' + Date.now() + '.' + ext;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const bucket = folder === 'image' ? 'listing-images' : 'store-docs';
    const { error } = await supabase.storage.from(bucket).upload(path, bytes.buffer, { contentType: mime });
    if (error) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!r.canceled) setImages([...images, r.assets[0].uri]);
  };

  const pickDoc = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (!r.canceled) setDocs([...docs, r.assets[0].uri]);
  };

  
  const captureGPS = async () => {
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location is required to pin your farm on the map.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      Alert.alert('Location Pinned', 'Your farm location has been captured.');
    } catch (e: any) {
      Alert.alert('GPS Error', e.message);
    } finally {
      setGpsBusy(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !location.trim() || images.length === 0 || docs.length === 0 || !coords) {
      Alert.alert('Missing info', 'Please fill all fields, upload docs, and pin your GPS location.');
      return;
    }
    const activePlan = PLANS.find(p => p.id === plan)!;
    const price = cycle === 'monthly' ? activePlan.month : activePlan.year;

    if (balance < price) {
      Alert.alert('Insufficient Balance', `You need ₦${price.toLocaleString()} but you have ₦${balance.toLocaleString()}. Please top up your wallet.`, [
        { text: 'Top Up', onPress: () => router.push('/wallet' as any) },
        { text: 'Cancel', style: 'cancel' }
      ]);
      return;
    }

    setBusy(true);
    try {
      const imgUrls = [];
      for (const uri of images) {
        const url = await uploadFile(uri, 'image/jpeg', 'image');
        if (url) imgUrls.push(url);
      }
      const docUrls = [];
      for (const uri of docs) {
        const url = await uploadFile(uri, 'application/pdf', 'doc');
        if (url) docUrls.push(url);
      }

      const { data, error } = await supabase.rpc('pay_store_rent', {
        p_store_name: name.trim(),
        p_store_type: plan,
        p_billing_cycle: cycle,
        p_location: location.trim(),
        p_images: imgUrls,
        p_documents: docUrls,
        p_amount: price,
        p_lat: coords.lat,
        p_lon: coords.lon,
      });

      if (error) throw error;

      Alert.alert('Success', 'Payment successful. Admin will review your store within 24 hours.');
      router.replace('/marketplace-store');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const activePlan = PLANS.find(p => p.id === plan)!;
  const price = cycle === 'monthly' ? activePlan.month : activePlan.year;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Rent a Store</Text>
        <Text style={styles.subtitle}>You need an active store to sell on GAIA.</Text>
        <Text style={[styles.subtitle, { color: palette.neon, fontWeight: 'bold' }]}>Wallet Balance: ₦{balance.toLocaleString()}</Text>

        <Text style={styles.label}>1. SELECT PLAN</Text>
        <View style={styles.planGrid}>
          {PLANS.map(p => (
            <Pressable key={p.id} onPress={() => setPlan(p.id)} style={[styles.planCard, plan === p.id && styles.planActive]}>
              <Text style={[styles.planName, plan === p.id && { color: '#000' }]}>{p.name}</Text>
              <Text style={[styles.planPrice, plan === p.id && { color: '#000' }]}>₦{p.month.toLocaleString()}/mo</Text>
              <Text style={[styles.planDesc, plan === p.id && { color: 'rgba(0,0,0,0.6)' }]}>{p.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>2. BILLING CYCLE</Text>
        <View style={styles.row}>
          <Pressable onPress={() => setCycle('monthly')} style={[styles.cycleBtn, cycle === 'monthly' && styles.cycleActive]}>
            <Text style={[styles.cycleTxt, cycle === 'monthly' && { color: '#000' }]}>Monthly</Text>
          </Pressable>
          <Pressable onPress={() => setCycle('annual')} style={[styles.cycleBtn, cycle === 'annual' && styles.cycleActive]}>
            <Text style={[styles.cycleTxt, cycle === 'annual' && { color: '#000' }]}>Annual (2 months free)</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>3. STORE DETAILS</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Store Name (e.g. Prosper Farms)" placeholderTextColor="#888" style={styles.input} />
        <TextInput value={location} onChangeText={setLocation} placeholder="Store/Farm Location (e.g. Kaduna North)" placeholderTextColor="#888" style={styles.input} />
        
        <Pressable onPress={captureGPS} disabled={gpsBusy} style={{ backgroundColor: coords ? 'rgba(0,255,136,0.2)' : p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.neon, alignItems: 'center', marginTop: 8 }}>
          {gpsBusy ? <ActivityIndicator color={p.neon} /> : <Text style={{ color: p.neon, fontWeight: '900' }}>{coords ? '✅ Location Pinned (GPS)' : '📍 Pin Farm Location on Map'}</Text>}
        </Pressable>

        <Text style={styles.label}>4. STORE IMAGES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {images.map((img, i) => <Image key={i} source={{ uri: img }} style={styles.thumb} />)}
            <Pressable onPress={pickImage} style={styles.addBtn}><Text style={styles.addTxt}>+ Add Image</Text></Pressable>
          </View>
        </ScrollView>

        <Text style={styles.label}>5. LEASE / ID / ATTESTATION LETTER</Text>
        <Text style={styles.hint}>Upload any proof that you own/rent the land (e.g. ID Card, Community Letter, Lease).</Text>
        {docs.map((d, i) => <Text key={i} style={styles.docTxt}>📎 Document {i+1} attached</Text>)}
        <Pressable onPress={pickDoc} style={styles.addDocBtn}><Text style={styles.addTxt}>+ Upload Document</Text></Pressable>

        <View style={styles.totalBox}>
          <Text style={styles.totalLbl}>TOTAL TO PAY FROM WALLET</Text>
          <Text style={styles.totalVal}>₦{price.toLocaleString()}</Text>
        </View>

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>PAY ₦{price.toLocaleString()} & APPLY</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  hint: { fontSize: 11, color: p.textDim, marginBottom: 8, fontStyle: 'italic' },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planCard: { width: '48%', padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  planActive: { backgroundColor: p.neon, borderColor: p.neon },
  planName: { fontSize: 16, fontWeight: '900', color: p.text },
  planPrice: { fontSize: 14, fontWeight: '700', color: p.neon, marginTop: 4 },
  planDesc: { fontSize: 10, color: p.textMuted, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  cycleBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  cycleActive: { backgroundColor: p.neon, borderColor: p.neon },
  cycleTxt: { fontSize: 13, fontWeight: '700', color: p.text },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, marginBottom: 10 },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  addBtn: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: p.neon, alignItems: 'center', justifyContent: 'center' },
  addDocBtn: { padding: 14, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: p.neon, alignItems: 'center' },
  addTxt: { fontSize: 11, fontWeight: '800', color: p.neon },
  docTxt: { fontSize: 12, color: p.text, marginBottom: 4 },
  totalBox: { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.1)', alignItems: 'center' },
  totalLbl: { fontSize: 10, fontWeight: '900', color: p.neon },
  totalVal: { fontSize: 28, fontWeight: '900', color: p.text, marginTop: 4 },
  cta: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian },
});
