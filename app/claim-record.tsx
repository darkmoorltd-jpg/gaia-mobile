import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const API = 'https://gaia-api-xuly.onrender.com';
const CONSENT = 'By claiming this record, I agree to share my farm data with GAIA partners (banks, insurers, Ministry of Agriculture) for agricultural services in accordance with NDPA 2023.';

export default function ClaimRecord() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);

  const [step, setStep] = useState<'nin' | 'preview' | 'otp' | 'success'>('nin');
  const [nin, setNin] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [otpTarget, setOtpTarget] = useState('');
  const [otp, setOtp] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<any>(null);

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const search = async () => {
    if (nin.length !== 11) { setErr('NIN must be 11 digits'); return; }
    setBusy(true); setErr('');
    try {
      const t = await token();
      const r = await fetch(API + '/ndfr/claim/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
        body: JSON.stringify({ nin }),
      });
      const d = await r.json();
      if (!r.ok || !d.found) { setErr(d.detail || d.error || 'Record not found'); }
      else { setClaimToken(d.claim_token); setPreview(d.preview); setOtpTarget(d.otp_target); setStep('preview'); }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const sendOTP = async () => {
    setBusy(true); setErr('');
    try {
      const t = await token();
      const r = await fetch(API + '/ndfr/claim/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
        body: JSON.stringify({ claim_token: claimToken }),
      });
      const d = await r.json();
      if (!r.ok || !d.sent) { setErr(d.detail || d.error || 'Could not send OTP'); }
      else { setStep('otp'); }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const confirmClaim = async () => {
    if (!consent) { setErr('Please accept the consent to claim'); return; }
    if (otp.length !== 6) { setErr('OTP must be 6 digits'); return; }
    setBusy(true); setErr('');
    try {
      const t = await token();
      const r = await fetch(API + '/ndfr/claim/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
        body: JSON.stringify({ claim_token: claimToken, otp, consent: true, consent_text: CONSENT }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) { setErr(d.detail || d.error || 'Claim failed'); }
      else { setDone(d.record); setStep('success'); }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const reset = () => { setStep('nin'); setPreview(null); setClaimToken(''); setOtp(''); setConsent(false); setErr(''); };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Claim Farm Record</Text>
        <Text style={s.sub}>Find your record from state registries and link it to GAIA</Text>

        {step === 'nin' && (
          <>
            <Text style={s.label}>ENTER YOUR NIN (11 digits)</Text>
            <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} style={s.input} placeholder="e.g. 12345678901" placeholderTextColor="#888" />
            <Pressable onPress={search} disabled={busy} style={[s.cta, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={s.ctaTxt}>SEARCH</Text>}
            </Pressable>
            <Text style={s.hint}>Your NIN was recorded when the state or a partner program registered your farm. If you don't have one, ask your extension agent.</Text>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <Text style={s.label}>WE FOUND A MATCH</Text>
            <View style={s.card}>
              <View style={s.row}><Text style={s.k}>Name</Text><Text style={s.v}>{preview.name}</Text></View>
              <View style={s.row}><Text style={s.k}>State</Text><Text style={s.v}>{preview.state}</Text></View>
              <View style={s.row}><Text style={s.k}>LGA</Text><Text style={s.v}>{preview.lga}</Text></View>
              <View style={s.row}><Text style={s.k}>Crop</Text><Text style={s.v}>{preview.crop}</Text></View>
              <View style={s.row}><Text style={s.k}>Farm</Text><Text style={s.v}>{preview.farm_size_label}</Text></View>
            </View>
            <Text style={s.hint}>To confirm this is you, we'll send a 6-digit code to {otpTarget}</Text>
            <Pressable onPress={sendOTP} disabled={busy} style={[s.cta, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={s.ctaTxt}>SEND CODE</Text>}
            </Pressable>
            <Pressable onPress={reset} style={s.ghost}>
              <Text style={s.ghostTxt}>Not me — search again</Text>
            </Pressable>
          </>
        )}

        {step === 'otp' && (
          <>
            <Text style={s.label}>CODE SENT TO {otpTarget}</Text>
            <TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} style={s.input} placeholder="6-digit code" placeholderTextColor="#888" />
            <Pressable onPress={() => setConsent(!consent)} style={s.consentBox}>
              <View style={[s.cb, consent && s.cbOn]}>{consent ? <Text style={s.cbMark}>✓</Text> : null}</View>
              <Text style={s.consentText}>{CONSENT}</Text>
            </Pressable>
            <Pressable onPress={confirmClaim} disabled={busy} style={[s.cta, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={s.ctaTxt}>CONFIRM CLAIM</Text>}
            </Pressable>
            <Pressable onPress={reset} style={s.ghost}>
              <Text style={s.ghostTxt}>Cancel</Text>
            </Pressable>
          </>
        )}

        {step === 'success' && done && (
          <View style={s.success}>
            <Text style={s.successEmoji}>🎉</Text>
            <Text style={s.successTitle}>Record Claimed!</Text>
            <Text style={s.successSub}>Your farm record is now linked to your GAIA account.</Text>
            <View style={s.card}>
              <View style={s.row}><Text style={s.k}>Name</Text><Text style={s.v}>{done.name}</Text></View>
              <View style={s.row}><Text style={s.k}>State</Text><Text style={s.v}>{done.state}</Text></View>
              <View style={s.row}><Text style={s.k}>Crop</Text><Text style={s.v}>{done.crop}</Text></View>
            </View>
            <Pressable onPress={() => router.back()} style={s.cta}>
              <Text style={s.ctaTxt}>DONE</Text>
            </Pressable>
          </View>
        )}

        {err ? <Text style={s.err}>{err}</Text> : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 16 },
  cta: { marginTop: 16, paddingVertical: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  ghost: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  ghostTxt: { fontSize: 12, color: p.textMuted },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontSize: 12, color: p.textMuted },
  v: { fontSize: 13, fontWeight: '700', color: p.text, flex: 1, textAlign: 'right', marginLeft: 12 },
  hint: { fontSize: 12, color: p.textMuted, marginTop: 12, lineHeight: 18, fontStyle: 'italic' },
  consentBox: { marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: p.border, flexDirection: 'row', gap: 12 },
  cb: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cbOn: { backgroundColor: p.neon, borderColor: p.neon },
  cbMark: { fontSize: 14, fontWeight: '900', color: p.obsidian },
  consentText: { fontSize: 11, color: p.textMuted, flex: 1, lineHeight: 16 },
  err: { color: p.danger, fontSize: 12, marginTop: 16, textAlign: 'center' },
  success: { alignItems: 'center', paddingVertical: 20 },
  successEmoji: { fontSize: 60, marginBottom: 12 },
  successTitle: { fontSize: 24, fontWeight: '900', color: p.text, marginBottom: 8 },
  successSub: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
});
