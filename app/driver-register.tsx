import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function DriverRegister() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [license, setLicense] = useState('');
  const [plate, setPlate] = useState('');
  const [vType, setVType] = useState('Flatbed');
  const [capacity, setCapacity] = useState('');
  const [bankName, setBankName] = useState('');
  const [acctNum, setAcctNum] = useState('');
  const [acctName, setAcctName] = useState('');
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!r.canceled) setLicenseImage(r.assets[0].uri);
  };

  const uploadDoc = async (uri: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
    const path = `license-${user.id}-${Date.now()}.jpg`;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const { error } = await supabase.storage.from('driver-docs').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data } = supabase.storage.from('driver-docs').getPublicUrl(path);
    return data.publicUrl;
  };

  const submit = async () => {
    if (!license || !plate || !capacity || !bankName || !acctNum) {
      return Alert.alert('Missing', 'Please fill all required fields.');
    }
    setBusy(true);
    try {
      let licenseUrl = null;
      if (licenseImage) licenseUrl = await uploadDoc(licenseImage);

      // 1. Create Driver Profile
      await supabase.from('driver_profiles').insert({
        user_id: user.id,
        license_number: license,
        license_url: licenseUrl,
        bank_name: bankName,
        bank_account_number: acctNum,
        bank_account_name: acctName,
        status: 'pending',
      });

      // 2. Create Vehicle
      await supabase.from('vehicles').insert({
        driver_id: user.id,
        plate_number: plate,
        vehicle_type: vType,
        capacity_tonnes: parseFloat(capacity),
      });

      Alert.alert('Success', 'Application submitted! Admin will review your documents.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Become a GAIA Driver</Text>
        <Text style={styles.sub}>Join the logistics network and earn money moving cargo.</Text>

        <Text style={styles.sectionLabel}>DRIVER DETAILS</Text>
        <Text style={styles.label}>DRIVER'S LICENSE NUMBER *</Text>
        <TextInput value={license} onChangeText={setLicense} style={styles.input} placeholderTextColor="#666" />
        
        <Text style={styles.label}>UPLOAD LICENSE PHOTO *</Text>
        <Pressable onPress={pickImage} style={styles.uploadBtn}>
          <Text style={styles.uploadText}>{licenseImage ? '✅ License Uploaded' : '📸 Select License Image'}</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>VEHICLE DETAILS</Text>
        <Text style={styles.label}>PLATE NUMBER *</Text>
        <TextInput value={plate} onChangeText={setPlate} style={styles.input} placeholder="e.g. KJA-123-XY" placeholderTextColor="#666" autoCapitalize="characters" />
        
        <Text style={styles.label}>VEHICLE TYPE *</Text>
        <TextInput value={vType} onChangeText={setVType} style={styles.input} placeholderTextColor="#666" />

        <Text style={styles.label}>MAX CAPACITY (TONNES) *</Text>
        <TextInput value={capacity} onChangeText={setCapacity} keyboardType="numeric" style={styles.input} placeholder="e.g. 10" placeholderTextColor="#666" />

        <Text style={styles.sectionLabel}>PAYOUT BANK ACCOUNT</Text>
        <Text style={styles.label}>BANK NAME *</Text>
        <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholderTextColor="#666" />
        
        <Text style={styles.label}>ACCOUNT NUMBER *</Text>
        <TextInput value={acctNum} onChangeText={setAcctNum} keyboardType="numeric" maxLength={10} style={styles.input} placeholderTextColor="#666" />
        
        <Text style={styles.label}>ACCOUNT NAME</Text>
        <TextInput value={acctName} onChangeText={setAcctName} style={styles.input} placeholderTextColor="#666" />

        <Pressable onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>SUBMIT APPLICATION</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, marginTop: 20, marginBottom: 8, letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 6 },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  uploadBtn: { backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, borderStyle: 'dashed', alignItems: 'center', marginBottom: 12 },
  uploadText: { color: p.neon, fontWeight: '700' },
  btn: { backgroundColor: p.neon, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  btnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
