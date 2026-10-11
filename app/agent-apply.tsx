import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const FEE_KOBO = 300000;

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

function newRef() {
  return 'GAIA_AGENT_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function AgentApply() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [state, setState] = useState('Kaduna');
  const [lga, setLga] = useState('');
  const [zone, setZone] = useState('');
  const [organization, setOrganization] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [experience, setExperience] = useState('');
  const [motivation, setMotivation] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [bankStatement, setBankStatement] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [done, setDone] = useState(false);

  const pickImage = async (setter: (v: string) => void) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const pickPdf = async (setter: (v: string) => void) => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf','image/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) setter(r.assets[0].uri);
  };

  const uploadToSupabase = async (uri: string, folder: string, mime: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const ext = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
      const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from('agent-docs').upload(path, bytes.buffer, { contentType: mime, upsert: false });
      if (error) { console.log('upload err', error); return null; }
      const { data } = supabase.storage.from('agent-docs').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) { console.log('upload ex', e); return null; }
  };

  const submit = async () => {
    if (!fullName || !email || !phone || !bvn || !nin) {
      Alert.alert('Missing', 'Name, email, phone, BVN, and NIN are required.'); return;
    }
    if (bvn.length !== 11 || nin.length !== 11) {
      Alert.alert('Invalid', 'BVN and NIN must be 11 digits each.'); return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Password', 'Set a password (min 6 characters) so you can log in while your application is reviewed.'); return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match'); return;
    }
    setBusy(true);
    try {
      // 1. Create the auth account so they can log in as a normal user
      const signUp = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
      if (signUp.error && !signUp.error.message.toLowerCase().includes('already')) {
        Alert.alert('Signup failed', signUp.error.message); setBusy(false); return;
      }

      // 2. Upload docs
      let idUrl: string | null = null, selfieUrl: string | null = null, stmtUrl: string | null = null;
      if (idImage) idUrl = await uploadToSupabase(idImage, 'ids', 'image/jpeg');
      if (selfie) selfieUrl = await uploadToSupabase(selfie, 'selfies', 'image/jpeg');
      if (bankStatement) stmtUrl = await uploadToSupabase(bankStatement, 'statements', 'application/pdf');

      // 3. Create application
      const r = await supabase.rpc('agent_apply', {
        p_full_name: fullName.trim(), p_email: email.trim(), p_phone: phone.trim(),
        p_state: state, p_lga: lga || null, p_zone: zone || null,
        p_organization: organization || null, p_experience_years: parseInt(experience) || 0,
        p_motivation: motivation || null,
        p_whatsapp: whatsapp || null, p_home_address: homeAddress || null,
        p_bvn: bvn, p_nin: nin,
        p_bank_name: bankName || null, p_bank_account_number: bankAccountNumber || null,
        p_bank_account_name: bankAccountName || null,
        p_id_image_url: idUrl, p_selfie_url: selfieUrl, p_bank_statement_url: stmtUrl,
      });
      if (r.error) { Alert.alert('Failed', r.error.message); setBusy(false); return; }
      const appId = (r.data && r.data.application_id) || null;
      setApplicationId(appId);
      setPayRef(newRef());
      setShowPay(true);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally { setBusy(false); }
  };

  const onPayMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.status === 'success' && applicationId) {
        await supabase.rpc('agent_mark_paid', { p_application_id: applicationId, p_reference: msg.reference });
        await supabase.auth.signOut();
        setShowPay(false);
        setDone(true);
      } else if (msg.status === 'closed') {
        setShowPay(false);
        Alert.alert('Payment cancelled', 'You can retry from the submit button.');
      }
    } catch (e) { console.log('pay parse', e); }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>OK</Text>
            <Text style={styles.doneTitle}>Application + payment received</Text>
            <Text style={styles.doneBody}>
              You can now log in with your email and password as a normal user.{'\n\n'}
              Your agent application is pending admin approval. Once approved, you can sign in via the AGENT tab.
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.cta}>
              <Text style={styles.ctaText}>BACK TO LOGIN</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const payHtml = payRef ? `
    <html><body style="margin:0;background:#000;">
    <script src="https://js.paystack.co/v1/inline.js"></script>
    <script>
      PaystackPop.setup({
        key: '${PAYSTACK_PUBLIC}',
        email: '${email.trim()}',
        amount: ${FEE_KOBO},
        currency: 'NGN',
        ref: '${payRef}',
        metadata: { custom_fields: [{ display_name: 'Type', variable_name: 'type', value: 'agent_registration' }] },
        callback: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'success', reference: response.reference}));
        },
        onClose: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'}));
        }
      }).openIframe();
    </script></body></html>` : '';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Become a GAIA Agent</Text>
        <Text style={styles.sub}>Register farmers and earn N500 per approved verification. Registration fee: N3,000.</Text>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <Text style={styles.label}>EMAIL *</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>PASSWORD * (min 6 chars)</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>CONFIRM PASSWORD *</Text>
        <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.sectionLabel}>PERSONAL</Text>
        <Text style={styles.label}>FULL NAME *</Text>
        <TextInput value={fullName} onChangeText={setFullName} placeholder="Ibrahim Yusuf" placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>PHONE *</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08031234567" placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>WHATSAPP</Text>
        <TextInput value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>HOME ADDRESS</Text>
        <TextInput value={homeAddress} onChangeText={setHomeAddress} multiline style={[styles.input, { minHeight: 70 }]} placeholderTextColor={palette.textDim} />

        <Text style={styles.sectionLabel}>LOCATION</Text>
        <Text style={styles.label}>STATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATES.map((s) => (
            <Pressable key={s} onPress={() => setState(s)} style={[styles.chip, state === s && styles.chipOn]}>
              <Text style={[styles.chipText, state === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>LGA</Text>
        <TextInput value={lga} onChangeText={setLga} placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>ZONE</Text>
        <TextInput value={zone} onChangeText={setZone} placeholder="Kaduna North" placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>ORGANIZATION</Text>
        <TextInput value={organization} onChangeText={setOrganization} placeholder="BOA Kaduna" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.sectionLabel}>KYC</Text>
        <Text style={styles.label}>BVN (11 DIGITS) *</Text>
        <TextInput value={bvn} onChangeText={setBvn} keyboardType="number-pad" maxLength={11} placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>NIN (11 DIGITS) *</Text>
        <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>ID CARD PHOTO</Text>
        <Pressable onPress={() => pickImage(setIdImage)} style={styles.uploadBtn}>
          <Text style={styles.uploadText}>{idImage ? 'Change ID photo' : 'Upload ID photo'}</Text>
        </Pressable>
        {idImage ? <Image source={{ uri: idImage }} style={styles.thumb} /> : null}

        <Text style={styles.label}>SELFIE HOLDING ID</Text>
        <Pressable onPress={() => pickImage(setSelfie)} style={styles.uploadBtn}>
          <Text style={styles.uploadText}>{selfie ? 'Change selfie' : 'Upload selfie'}</Text>
        </Pressable>
        {selfie ? <Image source={{ uri: selfie }} style={styles.thumb} /> : null}

        <Text style={styles.sectionLabel}>BANK</Text>
        <Text style={styles.label}>BANK NAME</Text>
        <TextInput value={bankName} onChangeText={setBankName} placeholder="GTBank" placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>ACCOUNT NUMBER</Text>
        <TextInput value={bankAccountNumber} onChangeText={setBankAccountNumber} keyboardType="number-pad" maxLength={10} placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>ACCOUNT NAME</Text>
        <TextInput value={bankAccountName} onChangeText={setBankAccountName} placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>BANK STATEMENT (PDF/IMAGE)</Text>
        <Pressable onPress={() => pickPdf(setBankStatement)} style={styles.uploadBtn}>
          <Text style={styles.uploadText}>{bankStatement ? 'Change statement' : 'Upload bank statement'}</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>EXPERIENCE</Text>
        <Text style={styles.label}>YEARS OF EXPERIENCE</Text>
        <TextInput value={experience} onChangeText={setExperience} keyboardType="number-pad" placeholderTextColor={palette.textDim} style={styles.input} />
        <Text style={styles.label}>WHY DO YOU WANT TO BE AN AGENT?</Text>
        <TextInput value={motivation} onChangeText={setMotivation} multiline style={[styles.input, { minHeight: 100 }]} placeholderTextColor={palette.textDim} />

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SUBMIT + PAY N3,000</Text>}
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={showPay} animationType="slide" onRequestClose={() => setShowPay(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable onPress={() => setShowPay(false)} style={{ padding: 16 }}>
            <Text style={{ color: '#00ff88', fontWeight: '900', letterSpacing: 1 }}>CANCEL</Text>
          </Pressable>
          {payHtml ? <WebView source={{ html: payHtml }} onMessage={onPayMessage} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled /> : null}
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
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 4 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chips: { gap: 6, paddingRight: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  uploadBtn: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderStyle: 'dashed', alignItems: 'center' },
  uploadText: { fontSize: 13, fontWeight: '700', color: p.neon },
  thumb: { width: 120, height: 120, borderRadius: 12, marginTop: 8 },
  doneBox: { padding: 30, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.neon, alignItems: 'center', marginTop: 60 },
  doneIcon: { fontSize: 20, fontWeight: '900', color: p.neon, letterSpacing: 2 },
  doneTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 12 },
  doneBody: { fontSize: 13, color: p.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
