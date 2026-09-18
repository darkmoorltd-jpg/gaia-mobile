import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Linking, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const VERIFICATION_FEE = 2000;
const PAYSTACK_VERIFICATION_URL = 'https://paystack.shop/pay/verification-fee';

export default function Verification() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [address, setAddress] = useState('');
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [crop, setCrop] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const pickImage = async (setter: (v: string) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled) setter(res.assets[0].uri);
  };

  const uploadFile = async (uri: string, name: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const path = user!.id + '/' + name + '_' + Date.now() + '.jpg';
      const { error } = await supabase.storage
        .from('verifications')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('verifications').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      return null;
    }
  };

  const submit = async () => {
    if (!fullName || !phone || !state || !idPhoto || !selfie) {
      setMessage('Please fill all required fields and upload ID + selfie');
      return;
    }
    setBusy(true);
    setMessage('');

    try {
      const idUrl = await uploadFile(idPhoto, 'id');
      const selfieUrl = await uploadFile(selfie, 'selfie');

      const { error } = await supabase.from('farmer_verifications').upsert({
        user_id: user!.id,
        full_name: fullName,
        phone,
        state,
        lga,
        address,
        bvn,
        nin,
        crop,
        farm_size: farmSize,
        id_photo_url: idUrl,
        selfie_url: selfieUrl,
        status: 'pending_payment',
        fee_naira: VERIFICATION_FEE,
      });

      if (error) throw error;
      setMessage('Data saved. Proceeding to payment...');
      setTimeout(() => Linking.openURL(PAYSTACK_VERIFICATION_URL), 1500);
    } catch (e: any) {
      setMessage(e?.message ?? 'Submission failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.subtitle}>
          Unlock wallet, loans, insurance, and marketplace. One-time fee of N2,000.
        </Text>

        <View style={styles.feeBox}>
          <Text style={styles.feeLabel}>VERIFICATION FEE</Text>
          <Text style={styles.feeValue}>N2,000</Text>
        </View>

        <Text style={styles.section}>PERSONAL</Text>
        <Input label="FULL NAME" value={fullName} onChange={setFullName} palette={palette} />
        <Input label="PHONE" value={phone} onChange={setPhone} keyboard="phone-pad" palette={palette} />
        <Input label="STATE" value={state} onChange={setState} palette={palette} />
        <Input label="LGA" value={lga} onChange={setLga} palette={palette} />
        <Input label="ADDRESS" value={address} onChange={setAddress} palette={palette} />

        <Text style={styles.section}>IDENTITY</Text>
        <Input label="BVN" value={bvn} onChange={setBvn} keyboard="number-pad" palette={palette} />
        <Input label="NIN" value={nin} onChange={setNin} keyboard="number-pad" palette={palette} />

        <Text style={styles.section}>FARM</Text>
        <Input label="MAIN CROP" value={crop} onChange={setCrop} palette={palette} />
        <Input label="FARM SIZE" value={farmSize} onChange={setFarmSize} palette={palette} />

        <Text style={styles.section}>UPLOADS</Text>
        <UploadBox label="ID DOCUMENT" uri={idPhoto} onPress={() => pickImage(setIdPhoto)} palette={palette} />
        <UploadBox label="SELFIE" uri={selfie} onPress={() => pickImage(setSelfie)} palette={palette} />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.cta, busy && { opacity: 0.5 }]}
        >
          <Text style={styles.ctaText}>
            {busy ? 'Submitting...' : 'SUBMIT AND PAY N2,000'}
          </Text>
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function Input({ label, value, onChange, keyboard, palette }: any) {
  const s = createStyles(palette);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard || 'default'}
          placeholder={label.toLowerCase()}
          placeholderTextColor={palette.textDim}
          style={s.input}
        />
      </View>
    </View>
  );
}

function UploadBox({ label, uri, onPress, palette }: any) {
  const s = createStyles(palette);
  return (
    <Pressable onPress={onPress} style={s.upload}>
      {uri ? (
        <Image source={{ uri }} style={s.uploadImg} />
      ) : (
        <View style={s.uploadPlaceholder}>
          <Text style={s.uploadIcon}>+</Text>
          <Text style={s.uploadLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -0.8 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 8, lineHeight: 20 },
  feeBox: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: p.neonSoft,
    borderWidth: 1,
    borderColor: p.borderHi,
  },
  feeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted },
  feeValue: { fontSize: 32, fontWeight: '900', color: p.neon, marginTop: 4 },
  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: p.textMuted,
    marginTop: 24,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: p.textMuted,
    marginBottom: 6,
  },
  inputWrap: {
    borderWidth: 1.5,
    borderColor: p.border,
    backgroundColor: p.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: { paddingVertical: 13, color: p.text, fontSize: 15 },
  upload: {
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: p.surface,
    borderWidth: 1.5,
    borderColor: p.border,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  uploadImg: { width: '100%', height: '100%' },
  uploadPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadIcon: { fontSize: 32, color: p.neon },
  uploadLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: p.textMuted,
    marginTop: 8,
  },
  message: { color: p.warning, textAlign: 'center', marginTop: 14, fontSize: 13 },
  cta: {
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    backgroundColor: p.neon,
    alignItems: 'center',
  },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
