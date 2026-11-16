import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

type Step = 1 | 2 | 3 | 4 | 5;

export default function SellerVerify() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);

  const [legalName, setLegalName] = useState('');
  const [dob, setDob] = useState('');
  const [nin, setNin] = useState('');

  const [cac, setCac] = useState('');

  const [bankName, setBankName] = useState('');
  const [acctNum, setAcctNum] = useState('');
  const [acctName, setAcctName] = useState('');

  const [state, setState] = useState('Lagos');
  const [lga, setLga] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  const [selfie, setSelfie] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [cacCert, setCacCert] = useState<string | null>(null);

  const pick = async (setter: (s: string | null) => void) => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const takeSelfie = async (setter: (s: string | null) => void) => {
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const captureGPS = async () => {
    setLocBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission denied', 'Location is required to pin your farm.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(pos.coords.latitude);
      setLon(pos.coords.longitude);
      Alert.alert('Location pinned', `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
    } catch (e: any) {
      Alert.alert('GPS failed', e.message);
    } finally {
      setLocBusy(false);
    }
  };

  const upload = async (uri: string, key: string): Promise<string> => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user!.id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('seller-docs')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  };

  const validate = (): string | null => {
    if (step === 1) {
      if (!legalName.trim() || legalName.trim().length < 3) return 'Legal name required';
      if (!dob) return 'Date of birth required';
      const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
      if (age < 18) return 'Must be 18 or older';
      if (nin.replace(/\D/g, '').length !== 11) return 'NIN must be 11 digits';
    }
    if (step === 2 && !cac.trim()) return 'CAC registration required';
    if (step === 3) {
      if (!bankName.trim()) return 'Bank name required';
      if (acctNum.replace(/\D/g, '').length !== 10) return 'Account must be 10 digits';
      if (!acctName.trim()) return 'Account name required';
    }
    if (step === 4) {
      if (!lga.trim()) return 'LGA required';
      if (!address.trim()) return 'Farm address required';
      if (lat == null || lon == null) return 'Pin farm location (GPS)';
    }
    if (step === 5) {
      if (!selfie) return 'Selfie with ID required';
      if (!idDoc) return 'ID document required';
      if (!cacCert) return 'CAC certificate required';
    }
    return null;
  };

  const next = () => {
    const err = validate();
    if (err) { Alert.alert('Missing', err); return; }
    setStep((step + 1) as Step);
  };

  const back = () => {
    if (step === 1) { router.back(); return; }
    setStep((step - 1) as Step);
  };

  const submit = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing', err); return; }
    setBusy(true);
    try {
      const selfiePath = await upload(selfie!, 'selfie');
      const idPath = await upload(idDoc!, 'id');
      const cacPath = await upload(cacCert!, 'cac');

      const { data, error } = await supabase.rpc('submit_seller_verification', {
        p_legal_name: legalName.trim(),
        p_date_of_birth: dob,
        p_nin: nin.replace(/\D/g, ''),
        p_cac_registration: cac.trim().toUpperCase(),
        p_bank_name: bankName.trim(),
        p_bank_account_number: acctNum.replace(/\D/g, ''),
        p_bank_account_name: acctName.trim(),
        p_farm_gps_lat: lat,
        p_farm_gps_lon: lon,
        p_farm_address: address.trim(),
        p_farm_state: state,
        p_farm_lga: lga.trim(),
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Submission failed');

      const verificationId = data.verification_id;
      const docs = [
        { doc_type: 'selfie_with_id', file_path: selfiePath },
        { doc_type: 'id_document', file_path: idPath },
        { doc_type: 'cac_certificate', file_path: cacPath },
      ];
      for (const d of docs) {
        await supabase.from('seller_documents').insert({
          user_id: user!.id,
          verification_id: verificationId,
          doc_type: d.doc_type,
          file_path: d.file_path,
        });
      }

      Alert.alert('Submitted', 'Admin will review within 1-2 business days.', [
        { text: 'OK', onPress: () => router.replace('/seller-dashboard' as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Submission failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={back}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Become a Seller</Text>
        <View style={styles.progress}>
          {[1,2,3,4,5].map(s => <View key={s} style={[styles.dot, step >= s && styles.dotActive]} />)}
        </View>
        <Text style={styles.stepLabel}>Step {step} of 5</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 1 && (
          <>
            <Text style={styles.sectionLabel}>IDENTITY</Text>
            <Text style={styles.label}>LEGAL NAME *</Text>
            <TextInput value={legalName} onChangeText={setLegalName} style={styles.input} placeholder="Must match ID" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>DATE OF BIRTH (YYYY-MM-DD) *</Text>
            <TextInput value={dob} onChangeText={setDob} placeholder="1990-01-01" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>NIN (11 digits) *</Text>
            <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} style={styles.input} placeholderTextColor={palette.textDim} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionLabel}>BUSINESS</Text>
            <Text style={styles.label}>CAC REGISTRATION *</Text>
            <TextInput value={cac} onChangeText={setCac} style={styles.input} placeholder="RC-1234567" placeholderTextColor={palette.textDim} autoCapitalize="characters" />
            <Text style={styles.hint}>Registered company or business name. You'll upload the certificate in step 5.</Text>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.sectionLabel}>PAYOUT BANK</Text>
            <Text style={styles.label}>BANK NAME *</Text>
            <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="Access Bank" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ACCOUNT NUMBER *</Text>
            <TextInput value={acctNum} onChangeText={setAcctNum} keyboardType="number-pad" maxLength={10} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ACCOUNT NAME *</Text>
            <TextInput value={acctName} onChangeText={setAcctName} style={styles.input} placeholder="Must match CAC name" placeholderTextColor={palette.textDim} />
            <Text style={styles.hint}>Account name must match your CAC registration. Mismatches will be rejected.</Text>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.sectionLabel}>FARM LOCATION</Text>
            <Text style={styles.label}>STATE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
              {NIGERIAN_STATES.map(s => (
                <Pressable key={s} onPress={() => setState(s)} style={[styles.chip, state === s && styles.chipOn]}>
                  <Text style={[styles.chipTxt, state === s && styles.chipTxtOn]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>LGA *</Text>
            <TextInput value={lga} onChangeText={setLga} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>FARM ADDRESS *</Text>
            <TextInput value={address} onChangeText={setAddress} multiline style={[styles.input, { minHeight: 70 }]} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>GPS PIN *</Text>
            <Pressable onPress={captureGPS} disabled={locBusy} style={styles.gpsBtn}>
              {locBusy ? <ActivityIndicator color={palette.neon} /> :
                <Text style={styles.gpsBtnTxt}>
                  {lat != null ? `📍 ${lat.toFixed(5)}, ${lon?.toFixed(5)}` : '📍 TAP TO PIN FARM LOCATION'}
                </Text>}
            </Pressable>
          </>
        )}

        {step === 5 && (
          <>
            <Text style={styles.sectionLabel}>DOCUMENTS</Text>
            <DocRow label="Selfie holding ID *" uri={selfie} onPick={() => takeSelfie(setSelfie)} />
            <DocRow label="Government ID *" uri={idDoc} onPick={() => pick(setIdDoc)} />
            <DocRow label="CAC certificate *" uri={cacCert} onPick={() => pick(setCacCert)} />
            <Text style={styles.hint}>Clear photos. Admin will compare against your typed info.</Text>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        {step < 5 ? (
          <Pressable onPress={next} style={styles.cta}>
            <Text style={styles.ctaTxt}>CONTINUE</Text>
          </Pressable>
        ) : (
          <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>SUBMIT FOR REVIEW</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function DocRow({ label, uri, onPick }: { label: string; uri: string | null; onPick: () => void }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, marginBottom: 8 }}>
      {uri ? <Image source={{ uri }} style={{ width: 48, height: 48, borderRadius: 8 }} /> : null}
      <Text style={{ flex: 1, fontSize: 13, color: palette.text }}>{label}</Text>
      <Pressable onPress={onPick} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: palette.neon, borderRadius: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: '900', color: palette.neon }}>{uri ? 'CHANGE' : 'ADD'}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  progress: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: p.border },
  dotActive: { backgroundColor: p.neon },
  stepLabel: { fontSize: 11, color: p.textMuted, marginTop: 8 },
  scroll: { padding: 20, paddingBottom: 120 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTxtOn: { color: p.neon },
  gpsBtn: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.1)', borderWidth: 1, borderColor: p.neon, alignItems: 'center', marginTop: 8 },
  gpsBtnTxt: { color: p.neon, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  hint: { fontSize: 11, color: p.textMuted, marginTop: 8, fontStyle: 'italic', lineHeight: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30, backgroundColor: p.obsidian, borderTopWidth: 1, borderTopColor: p.border },
  cta: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
