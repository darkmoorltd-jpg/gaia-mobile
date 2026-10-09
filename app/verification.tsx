import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Linking, TextInput, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const VERIFICATION_FEE = 2000;
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
  const [payRef, setPayRef] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [loadExisting, setLoadExisting] = useState(true);
  const [resubmitMode, setResubmitMode] = useState(false);
  const [rejectedDoc, setRejectedDoc] = useState<'id' | 'selfie' | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [acceptedDoc, setAcceptedDoc] = useState<'id' | 'selfie' | null>(null);
  const [verifId, setVerifId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('farmer_verifications')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          const s = (data.status || '').toLowerCase();
          const ps = (data.payment_status || '').toLowerCase();
          setVerifId(data.id);
          if (ps === 'paid' && (s === 'pending' || s === 'pending_review')) {
            setLockReason('pending_review');
          } else if (s === 'approved') {
            setLockReason('approved');
          } else if (s === 'documents_rejected') {
            const idRej = (data.id_status || '').toLowerCase() === 'rejected';
            const selfRej = (data.selfie_status || '').toLowerCase() === 'rejected';
            setResubmitMode(true);
            if (idRej) {
              setRejectedDoc('id');
              setRejectionReason(data.id_rejection_reason || 'Please upload a clearer document');
              if (!selfRej) setAcceptedDoc('selfie');
            } else if (selfRej) {
              setRejectedDoc('selfie');
              setRejectionReason(data.selfie_rejection_reason || 'Please upload a clearer selfie');
              if (!idRej) setAcceptedDoc('id');
            }
            if (data.full_name) setFullName(data.full_name);
            if (data.phone) setPhone(data.phone);
            if (data.state) setState(data.state);
            if (data.lga) setLga(data.lga);
            if (data.address) setAddress(data.address);
            if (data.bvn) setBvn(data.bvn);
            if (data.nin) setNin(data.nin);
            if (data.crop) setCrop(data.crop);
            if (data.farm_size) setFarmSize(String(data.farm_size));
            // Pre-fill only the accepted doc so it renders as read-only; rejected stays empty
            const idRej2 = (data.id_status || '').toLowerCase() === 'rejected';
            const selfRej2 = (data.selfie_status || '').toLowerCase() === 'rejected';
            if (selfRej2 && !idRej2) {
              setIdPhoto(data.id_photo_url || data.id_image_url || null);
            } else if (idRej2 && !selfRej2) {
              setSelfie(data.selfie_url || null);
            }
          } else if (s === 'rejected') {
            setLockReason(null);
          }
        }
      } catch {}
      setLoadExisting(false);
    })();
  }, [user]);

  const pickImage = async (setter: (v: string) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsEditing: true, aspect: [4, 3],
    });
    if (!res.canceled) setter(res.assets[0].uri);
  };

  const uploadFile = async (uri: string, name: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ab = await new Response(blob).arrayBuffer();
      const path = user!.id + '/' + name + '_' + Date.now() + '.jpg';
      const { error } = await supabase.storage
        .from('verifications')
        .upload(path, ab, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('verifications').getPublicUrl(path);
      return data.publicUrl;
    } catch { return null; }
  };

  const submit = async () => {
    // === RESUBMIT MODE: only the rejected doc was changed, no new payment ===
    if (resubmitMode) {
      setBusy(true); setMessage('');
      try {
        let newIdUrl: string | null = null;
        let newSelfieUrl: string | null = null;
        if (rejectedDoc === 'id') {
          if (!idPhoto) { setMessage('Please upload a new ID document'); setBusy(false); return; }
          newIdUrl = await uploadFile(idPhoto, 'id');
          if (!newIdUrl) throw new Error('ID upload failed');
        } else if (rejectedDoc === 'selfie') {
          if (!selfie) { setMessage('Please upload a new selfie'); setBusy(false); return; }
          newSelfieUrl = await uploadFile(selfie, 'selfie');
          if (!newSelfieUrl) throw new Error('Selfie upload failed');
        }
        const { error } = await supabase.rpc('user_resubmit_documents', {
          p_id_url: newIdUrl,
          p_selfie_url: newSelfieUrl,
        });
        if (error) throw error;
        setMessage('Resubmitted. No new payment required.');
        setResubmitMode(false);
        setRejectedDoc(null);
        setRejectionReason(null);
        setLockReason('pending_review');
      } catch (e: any) {
        setMessage(e?.message || 'Resubmit failed');
      } finally { setBusy(false); }
      return;
    }

    // === NEW SUBMISSION PATH ===
    if (!fullName || !phone || !state || !idPhoto || !selfie) {
      setMessage('Please fill all required fields and upload ID + selfie');
      return;
    }
    if (!/^[0-9]{11}$/.test(bvn)) {
      setMessage('BVN must be exactly 11 digits');
      return;
    }
    if (!/^[0-9]{11}$/.test(nin)) {
      setMessage('NIN must be exactly 11 digits');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const idUrl = await uploadFile(idPhoto, 'id');
      const selfieUrl = await uploadFile(selfie, 'selfie');
      const ref = newRef(user!.id);
      const { error } = await supabase.from('farmer_verifications').upsert({
        user_id: user!.id,
        full_name: fullName,
        phone, state, lga, address, bvn, nin,
        crop, farm_size: farmSize,
        id_photo_url: idUrl,
        selfie_url: selfieUrl,
        status: 'pending_payment',
        payment_status: 'pending',
        payment_reference: ref,
        fee_naira: VERIFICATION_FEE,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setPayRef(ref);
      setMessage('Opening secure payment...');
    } catch (e: any) {
      setMessage(e?.message ?? 'Submission failed');
    } finally { setBusy(false); }
  };

  const onPaystackMessage = async (raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data?.status !== 'success') {
        setPayRef(null);
        setMessage('Payment cancelled. You can retry anytime.');
        return;
      }
      const ref = data.reference || payRef;
      if (!ref || !user) return;
      // Update verification row -> move to pending review
      await supabase.from('farmer_verifications').update({
        payment_status: 'paid',
        payment_reference: ref,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      // Record payment history
      await supabase.from('payment_history').insert({
        user_id: user.id,
        amount: VERIFICATION_FEE,
        plan: 'verification',
        reference: ref,
        scans_added: 0,
        paid_at: new Date().toISOString(),
      });
      setPayRef(null);
      setPaid(true);
      setMessage('');
    } catch (e: any) {
      Alert.alert('Payment record failed', e?.message || 'Contact support with your reference');
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
            amount: ${VERIFICATION_FEE * 100},
            currency: 'NGN',
            ref: '${payRef}',
            label: 'GAIA Verification',
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

  if (lockReason === 'pending_review') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Under review</Text>
          <Text style={styles.subtitle}>
            Your payment was received and your verification is being reviewed by our team.
            You will be notified once it is approved.
          </Text>
          <View style={styles.feeBox}>
            <Text style={styles.feeLabel}>STATUS</Text>
            <Text style={styles.feeValue}>Pending review</Text>
          </View>
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
          <Text style={styles.subtitle}>
            Your identity is verified. Wallet, loans, insurance, and marketplace are unlocked.
          </Text>
          <View style={styles.feeBox}>
            <Text style={styles.feeLabel}>STATUS</Text>
            <Text style={styles.feeValue}>Approved</Text>
          </View>
          <Pressable onPress={() => router.back()} style={styles.cta}>
            <Text style={styles.ctaText}>DONE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (loadExisting) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.subtitle}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (paid) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Payment successful</Text>
          <Text style={styles.subtitle}>
            Thank you. Your verification is now under review. You will be notified once approved.
          </Text>
          <View style={styles.feeBox}>
            <Text style={styles.feeLabel}>AMOUNT PAID</Text>
            <Text style={styles.feeValue}>N2,000</Text>
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>{resubmitMode ? 'Re-upload documents' : 'Verify your identity'}</Text>
        <Text style={styles.subtitle}>
          {resubmitMode
            ? 'Fix the rejected document below and tap resubmit. Free — no new payment.'
            : 'Unlock wallet, loans, insurance, and marketplace. One-time fee of N2,000.'}
        </Text>
        {!resubmitMode ? (
          <View style={styles.feeBox}>
            <Text style={styles.feeLabel}>VERIFICATION FEE</Text>
            <Text style={styles.feeValue}>N2,000</Text>
          </View>
        ) : null}
        <Text style={styles.section}>PERSONAL</Text>
        <Input label='FULL NAME' value={fullName} onChange={setFullName} palette={palette} />
        <Input label='PHONE' value={phone} onChange={setPhone} keyboard='phone-pad' palette={palette} />
        <Input label='STATE' value={state} onChange={setState} palette={palette} />
        <Input label='LGA' value={lga} onChange={setLga} palette={palette} />
        <Input label='ADDRESS' value={address} onChange={setAddress} palette={palette} />
        <Text style={styles.section}>IDENTITY</Text>
        <Input label='BVN (11 digits) *' value={bvn} onChange={(v: string) => setBvn(v.replace(/[^0-9]/g, '').slice(0, 11))} keyboard='number-pad' palette={palette} />
        <Input label='NIN (11 digits) *' value={nin} onChange={(v: string) => setNin(v.replace(/[^0-9]/g, '').slice(0, 11))} keyboard='number-pad' palette={palette} />
        <Text style={styles.section}>FARM</Text>
        <Input label='MAIN CROP' value={crop} onChange={setCrop} palette={palette} />
        <Input label='FARM SIZE' value={farmSize} onChange={setFarmSize} palette={palette} />
        <Text style={styles.section}>UPLOADS</Text>
        {resubmitMode ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <DocPanel
              label="ID DOCUMENT"
              uri={idPhoto}
              status={rejectedDoc === 'id' ? 'rejected' : 'accepted'}
              onPress={() => pickImage(setIdPhoto)}
              palette={palette}
            />
            <DocPanel
              label="SELFIE"
              uri={selfie}
              status={rejectedDoc === 'selfie' ? 'rejected' : 'accepted'}
              onPress={() => pickImage(setSelfie)}
              palette={palette}
            />
          </View>
        ) : (
          <>
            <UploadBox label='ID DOCUMENT' uri={idPhoto} onPress={() => pickImage(setIdPhoto)} palette={palette} />
            <UploadBox label='SELFIE' uri={selfie} onPress={() => pickImage(setSelfie)} palette={palette} />
          </>
        )}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          <Text style={styles.ctaText}>
            {busy ? 'Submitting...' : resubmitMode ? 'RESUBMIT FOR REVIEW (NO CHARGE)' : 'SUBMIT AND PAY N2,000'}
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
        <TextInput value={value} onChangeText={onChange} keyboardType={keyboard || 'default'}
          placeholder={label.toLowerCase()} placeholderTextColor={palette.textDim} style={s.input} />
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

function DocPanel({ label, uri, status, onPress, palette }: any) {
  const s = createStyles(palette);
  const isRejected = status === 'rejected';
  const isAccepted = status === 'accepted';
  const accent = isRejected ? palette.danger : palette.neon;
  const badgeBg = isRejected ? 'rgba(255,59,92,0.18)' : 'rgba(0,255,136,0.18)';
  const badgeLabel = isRejected ? 'NEEDS FIX' : 'ACCEPTED';
  const canTap = isRejected;

  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={s.docPanelLabel}>{label}</Text>
      <Pressable
        onPress={canTap ? onPress : undefined}
        disabled={!canTap}
        style={[
          s.docPanelBox,
          { borderColor: accent, borderStyle: isRejected ? 'dashed' : 'solid' },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={s.docPanelImg} />
        ) : (
          <View style={s.docPanelPlaceholder}>
            <Text style={s.docPanelPlus}>{isRejected ? '+' : '·'}</Text>
            <Text style={s.docPanelHint}>{isRejected ? 'Tap to re-upload' : 'No photo'}</Text>
          </View>
        )}
        <View style={[s.docPanelBadge, { backgroundColor: badgeBg, borderColor: accent }]}>
          <Text style={[s.docPanelBadgeTxt, { color: accent }]}>{badgeLabel}</Text>
        </View>
      </Pressable>
    </View>
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
