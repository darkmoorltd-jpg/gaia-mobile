import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { getKycFields } from '../src/data/kyc_requirements';
import { getPaymentConfig } from '../src/data/payment_config';
import LocationCascade from '../src/components/LocationCascade';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';

function newRef(uid: string) {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return 'GAIA_VER_' + uid.slice(0, 8) + '_' + Date.now().toString(36) + r;
}

export default function Verification() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [countryCode, setCountryCode] = useState<string>('NG');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [address, setAddress] = useState('');
  const [kycValues, setKycValues] = useState<Record<string, string>>({});
  const [crop, setCrop] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [payRef, setPayRef] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [loadExisting, setLoadExisting] = useState(true);

  // Load profile + existing verification
  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('country_code,country,phone,state,lga,street_address,first_name,last_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (prof) {
          const cc = prof.country_code || 'NG';
          setCountryCode(cc);
          if (prof.phone) setPhone(prof.phone);
          if (prof.state) setState(prof.state);
          if (prof.lga) setLga(prof.lga);
          if (prof.street_address) setAddress(prof.street_address);
          const n = [prof.first_name, prof.last_name].filter(Boolean).join(' ');
          if (n) setFullName(n);
        }

        const { data } = await supabase
          .from('farmer_verifications')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          const s = (data.status || '').toLowerCase();
          const ps = (data.payment_status || '').toLowerCase();
          if (ps === 'paid' && (s === 'pending' || s === 'pending_review')) setLockReason('pending_review');
          else if (s === 'approved') setLockReason('approved');
          if (data.kyc_data) setKycValues(data.kyc_data);
        }
      } catch {}
      setLoadExisting(false);
    })();
  }, [user]);

  const kycFields = getKycFields(countryCode);
  const payment = getPaymentConfig(countryCode);
  const isManual = payment.gateway === 'manual';

  const pickImage = async (setter: (v: string) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsEditing: true, aspect: [4, 3],
    });
    if (!res.canceled) setter(res.assets[0].uri);
  };

  const uploadFile = async (uri: string, name: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return null;
      const SUPABASE_URL = 'https://pxvtvuwlpzwlkdoxjrep.supabase.co';
      const path = user!.id + '/' + name + '_' + Date.now() + '.jpg';
      const uploadUrl = SUPABASE_URL + '/storage/v1/object/verifications/' + path;
      const res = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'false',
        },
      });
      if (res.status < 200 || res.status >= 300) return null;
      return SUPABASE_URL + '/storage/v1/object/public/verifications/' + path;
    } catch { return null; }
  };

  const validateKyc = (): string | null => {
    for (const f of kycFields) {
      if (!f.required) continue;
      const v = (kycValues[f.key] || '').trim();
      if (!v) return `${f.label} is required`;
      if (f.maxLength && v.length > f.maxLength) return `${f.label} must be at most ${f.maxLength} characters`;
    }
    return null;
  };

  const submit = async () => {
    if (!fullName || !phone || !state || !idPhoto || !selfie) {
      setMessage('Fill all required fields and upload ID + selfie');
      return;
    }
    const kycErr = validateKyc();
    if (kycErr) { setMessage(kycErr); return; }
    setBusy(true); setMessage('');
    try {
      const idUrl = await uploadFile(idPhoto, 'id');
      const selfieUrl = await uploadFile(selfie, 'selfie');
      if (!idUrl || !selfieUrl) throw new Error('Upload failed — check connection');
      const ref = newRef(user!.id);

      const { error } = await supabase.from('farmer_verifications').upsert({
        user_id: user!.id,
        full_name: fullName,
        phone, state, lga, address,
        country_code: countryCode,
        kyc_data: kycValues,
        id_photo_url: idUrl,
        selfie_url: selfieUrl,
        status: isManual ? 'pending_manual_payment' : 'pending_payment',
        payment_status: 'pending',
        payment_reference: ref,
        currency: payment.currency,
        fee_amount: payment.fee,
        fee_naira: countryCode === 'NG' ? payment.fee : Math.round(payment.fee * (payment.currency === 'USD' ? 1500 : 1)),
      }, { onConflict: 'user_id' });

      if (error) throw error;

      if (isManual) {
        setMessage(`Manual verification: send ${payment.feeLabel} to WhatsApp +234 800 000 0000 with your name. We'll confirm within 24h.`);
      } else {
        setPayRef(ref);
        setMessage('Opening secure payment...');
      }
    } catch (e: any) {
      setMessage(e?.message ?? 'Submission failed');
    } finally { setBusy(false); }
  };

  const onPaystackMessage = async (raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data?.status !== 'success') {
        setPayRef(null); setMessage('Payment cancelled.'); return;
      }
      const ref = data.reference || payRef;
      if (!ref || !user) return;
      await supabase.from('farmer_verifications').update({
        payment_status: 'paid',
        payment_reference: ref,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      setPayRef(null); setPaid(true); setMessage('');
    } catch (e: any) {
      Alert.alert('Payment record failed', e?.message || 'Contact support');
    }
  };

  const paystackHTML = () => `
    <!DOCTYPE html><html><head><meta charset='utf-8'/>
    <script src='https://js.paystack.co/v1/inline.js'></script></head>
    <body style='background:#000;margin:0'>
    <script>
      window.addEventListener('load', function() {
        try {
          var handler = PaystackPop.setup({
            key: '${PAYSTACK_PUBLIC}',
            email: '${user?.email || ''}',
            amount: ${Math.round(payment.fee * 100)},
            currency: '${payment.currency}',
            ref: '${payRef}',
            label: 'GAIA Verification (${payment.currency})',
            onClose: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'closed' })); },
            callback: function(response) { window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success', reference: response.reference })); }
          });
          handler.openIframe();
        } catch (err) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'error', message: String(err) }));
        }
      });
    </script></body></html>
  `;

  if (lockReason === 'pending_review') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Under review</Text>
          <Text style={styles.subtitle}>Your verification is being reviewed. You'll be notified once approved.</Text>
          <Pressable onPress={() => router.back()} style={styles.cta}>
            <Text style={styles.ctaText}>DONE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
  if (lockReason === 'approved') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>You are verified</Text>
          <Text style={styles.subtitle}>Wallet, loans, insurance, marketplace are unlocked.</Text>
          <Pressable onPress={() => router.back()} style={styles.cta}>
            <Text style={styles.ctaText}>DONE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
  if (loadExisting) {
    return <View style={styles.container}><Text style={styles.subtitle}>Loading...</Text></View>;
  }
  if (paid) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Payment successful</Text>
          <Text style={styles.subtitle}>Verification under review. You'll be notified.</Text>
          <View style={styles.feeBox}>
            <Text style={styles.feeLabel}>AMOUNT PAID</Text>
            <Text style={styles.feeValue}>{payment.feeLabel}</Text>
          </View>
          <Pressable onPress={() => router.back()} style={styles.cta}>
            <Text style={styles.ctaText}>DONE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
  if (payRef) {
    return (
      <View style={styles.container}>
        <WebView
          originWhitelist={['*']}
          source={{ html: paystackHTML() }}
          onMessage={(e) => onPaystackMessage(e.nativeEvent.data)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          style={{ flex: 1, backgroundColor: '#000' }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Verify your identity</Text>
        {/* DBG-COUNTRY */}
        <Text style={{fontSize: 10, color: "#ff9800", textAlign: "center", marginTop: 4, fontFamily: "monospace"}}>
          country_code={countryCode} · currency={payment.currency}
        </Text>
        <Text style={styles.subtitle}>
          Unlock wallet, loans, insurance, and marketplace. {isManual ? 'Manual verification required for your country.' : 'One-time fee applies.'}
        </Text>
        <View style={styles.feeBox}>
          <Text style={styles.feeLabel}>VERIFICATION FEE</Text>
          <Text style={styles.feeValue}>{payment.feeLabel}</Text>
          <Text style={styles.feeNote}>{payment.currency} · {countryCode}</Text>
        </View>

        <Text style={styles.section}>PERSONAL</Text>
        <Input label="FULL NAME *" value={fullName} onChange={setFullName} palette={palette} />
        <Input label="PHONE *" value={phone} onChange={setPhone} keyboard="phone-pad" palette={palette} />
        <LocationCascade
          countryCode={countryCode}
          countryLocked={false}
          primary={state}
          secondary={lga}
          city={''}
          showCity={false}
          showWard={false}
          debug={false}
          onChange={(u) => {
            if (u.primary !== undefined) setState(u.primary);
            if (u.secondary !== undefined) setLga(u.secondary);
          }}
        />
        <Input label="ADDRESS *" value={address} onChange={setAddress} palette={palette} />

        <Text style={styles.section}>IDENTITY ({countryCode})</Text>
        {kycFields.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            value={kycValues[field.key] || ''}
            onChange={(v: string) => setKycValues({ [field.key]: v })}
            keyboard={field.keyboard}
            maxLength={field.maxLength}
            palette={palette}
          />
        ))}

        <Text style={styles.section}>FARM</Text>
        <Input label="MAIN CROP" value={crop} onChange={setCrop} palette={palette} />
        <Input label="FARM SIZE (acres)" value={farmSize} onChange={setFarmSize} keyboard="decimal-pad" palette={palette} />

        <Text style={styles.section}>UPLOADS</Text>
        <UploadBox label="ID DOCUMENT" uri={idPhoto} onPress={() => pickImage(setIdPhoto)} palette={palette} />
        <UploadBox label="SELFIE" uri={selfie} onPress={() => pickImage(setSelfie)} palette={palette} />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          <Text style={styles.ctaText}>
            {busy ? 'Submitting...' : isManual ? 'SUBMIT FOR MANUAL REVIEW' : `SUBMIT AND PAY ${payment.feeLabel}`}
          </Text>
        </Pressable>
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function Input({ label, value, onChange, keyboard, maxLength, palette }: any) {
  const s = createStyles(palette);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard || 'default'}
          maxLength={maxLength}
          placeholder={label.replace(' *', '').toLowerCase()}
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
      {uri ? <Image source={{ uri }} style={s.uploadImg} /> : (
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
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -0.8, marginTop: 40 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 8, lineHeight: 20 },
  feeBox: { marginTop: 20, padding: 20, borderRadius: 16, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi },
  feeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted },
  feeValue: { fontSize: 32, fontWeight: '900', color: p.neon, marginTop: 4 },
  feeNote: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 14 },
  input: { paddingVertical: 13, color: p.text, fontSize: 15 },
  upload: { aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden', backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.border, borderStyle: 'dashed', marginBottom: 12 },
  uploadImg: { width: '100%', height: '100%' },
  uploadPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadIcon: { fontSize: 32, color: p.neon },
  uploadLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginTop: 8 },
  message: { color: p.warning, textAlign: 'center', marginTop: 14, fontSize: 13 },
  cta: { marginTop: 24, padding: 18, borderRadius: 16, backgroundColor: p.neon, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
