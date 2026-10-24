import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

type Step = 'otp' | 'password' | 'done';

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email as string) || '';
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [step, setStep] = useState<Step>('otp');
  const [otp, setOtp] = useState<string[]>(Array(8).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const focus = (idx: number) => {
    if (idx >= 0 && idx < 8) inputs.current[idx]?.focus();
  };

  const setDigit = (idx: number, val: string) => {
    const clean = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[idx] = clean;
    setOtp(next);
    if (clean && idx < 7) focus(idx + 1);
    if (clean && idx === 7 && next.every((d) => d !== '')) {
      Keyboard.dismiss();
      setTimeout(() => verifyCode(next.join('')), 100);
    }
  };

  const onKeyPress = (idx: number, e: any) => {
    if (e.nativeEvent.key === 'Backspace' && otp[idx] === '' && idx > 0) {
      focus(idx - 1);
    }
  };

  const verifyCode = async (code: string) => {
    if (!email) { setError('Missing email - restart from forgot password.'); return; }
    if (code.length !== 8) { setError('Enter the 8-digit code from your email.'); return; }
    setBusy(true); setError('');
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });
      if (err) {
        setError(err.message || 'Incorrect or expired code.');
        setOtp(Array(8).fill(''));
        setTimeout(() => focus(0), 150);
        setBusy(false);
        return;
      }
      if (!data.session) { setError('Verification failed - try again.'); setBusy(false); return; }
      setStep('password');
    } catch (e: any) {
      setError(e?.message || 'Verification failed.');
    } finally { setBusy(false); }
  };

  const updatePassword = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) { setError(err.message); setBusy(false); return; }
      setStep('done');
    } catch (e: any) { setError(e?.message || 'Reset failed.'); }
    finally { setBusy(false); }
  };

  const resendCode = async () => {
    if (!email || countdown > 0) return;
    setBusy(true); setError('');
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) { setError(err.message); setBusy(false); return; }
      setCountdown(60);
      Alert.alert('Code sent', 'Check your email for a new 8-digit code.');
    } catch (e: any) { setError(e?.message || 'Resend failed.'); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace('/(auth)/forgot-password')} style={{ marginBottom: 24 }}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        {step === 'otp' && (
          <>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.subtitle}>
              We sent an 8-digit code to {email}.{'\n'}Enter it below to reset your password.
            </Text>

            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  value={digit}
                  onChangeText={(v) => setDigit(i, v)}
                  onKeyPress={(e) => onKeyPress(i, e)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={[styles.otpBox, digit && styles.otpBoxFilled]}
                  textAlign="center"
                  autoFocus={i === 0}
                  selectionColor={palette.neon}
                />
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={() => verifyCode(otp.join(''))}
              disabled={busy || otp.some((d) => !d)}
              style={[styles.cta, (busy || otp.some((d) => !d)) && { opacity: 0.4 }]}
            >
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>VERIFY CODE</Text>}
            </Pressable>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
              <Text style={styles.helpText}>Didn't receive it? </Text>
              <Pressable onPress={resendCode} disabled={busy || countdown > 0}>
                <Text style={[styles.link, countdown > 0 && { opacity: 0.4 }]}>
                  {countdown > 0 ? 'Resend in ' + countdown + 's' : 'Resend code'}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 'password' && (
          <>
            <Text style={styles.title}>Set new password</Text>
            <Text style={styles.subtitle}>Choose a strong password - at least 6 characters.</Text>

            <Text style={styles.label}>NEW PASSWORD</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="******" placeholderTextColor={palette.textDim} style={styles.input} />

            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="******" placeholderTextColor={palette.textDim} style={styles.input} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={updatePassword} disabled={busy || !password || !confirm} style={[styles.cta, (busy || !password || !confirm) && { opacity: 0.4 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>RESET PASSWORD</Text>}
            </Pressable>
          </>
        )}

        {step === 'done' && (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>OK</Text>
            <Text style={styles.doneTitle}>Password updated</Text>
            <Text style={styles.doneBody}>You can now sign in with your new password.</Text>
            <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.cta}>
              <Text style={styles.ctaText}>BACK TO SIGN IN</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 8, lineHeight: 20, marginBottom: 28 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 24 },
  otpBox: {
    flex: 1, height: 60, borderRadius: 12,
    backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.border,
    color: p.text, fontSize: 22, fontWeight: '900',
  },
  otpBoxFilled: { borderColor: p.neon, backgroundColor: p.neonSoft },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6, marginTop: 8 },
  input: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.border,
    color: p.text, fontSize: 15, marginBottom: 16,
  },
  error: { color: p.danger, fontSize: 13, marginTop: 8, marginBottom: 8, textAlign: 'center' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 12 },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  helpText: { fontSize: 13, color: p.textMuted },
  link: { fontSize: 13, color: p.neon, fontWeight: '700' },
  doneBox: { padding: 24, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.borderHi, alignItems: 'center', marginTop: 40 },
  doneIcon: { fontSize: 32, color: p.neon, fontWeight: '900', marginBottom: 12 },
  doneTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginBottom: 8 },
  doneBody: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
});
