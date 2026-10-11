import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

export default function Signup() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const signUp = useAuth((s) => s.signUp);
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setGoogleBusy(true); setError('');
    const err = await signInWithGoogle();
    if (err) { setError(err); setGoogleBusy(false); return; }
    const isNew = useAuth.getState().isNewUser;
    setGoogleBusy(false);
    if (isNew) {
      router.replace('/(auth)/onboarding' as any);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    const err = await signUp(email.trim(), password);
    setBusy(false);
    if (err) { setError(err); return; }
    router.replace('/(auth)/onboarding' as any);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.leaf}>GAIA</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start diagnosing your farm in 30 seconds.</Text>

        {/* GOOGLE SIGNUP */}
        <Pressable
          onPress={handleGoogle}
          disabled={googleBusy || busy}
          style={[styles.googleBtn, (googleBusy || busy) && { opacity: 0.6 }]}
        >
          {googleBusy ? <ActivityIndicator color="#4285F4" /> : (
            <View style={styles.googleInner}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>SIGN UP WITH GOOGLE</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>EMAIL</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="you@example.com" placeholderTextColor={palette.textDim}
            style={styles.input} editable={!busy}
          />
        </View>

        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={password} onChangeText={setPassword}
            secureTextEntry placeholder="at least 6 characters"
            placeholderTextColor={palette.textDim} style={styles.input}
            editable={!busy}
          />
        </View>

        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={confirm} onChangeText={setConfirm}
            secureTextEntry placeholder="type it again"
            placeholderTextColor={palette.textDim} style={styles.input}
            editable={!busy}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={busy || googleBusy || !email || !password || !confirm}
          style={[styles.cta, (busy || googleBusy || !email || !password || !confirm) && { opacity: 0.4 }]}
        >
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>CREATE ACCOUNT</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 24 }}>
          <Text style={styles.signup}>Already have an account? Sign in</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 16 },
  leaf: { fontSize: 40, fontWeight: '900', color: p.neon, letterSpacing: 8, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: p.textMuted, marginTop: 6, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 14 },
  input: { paddingVertical: 14, color: p.text, fontSize: 15 },
  error: { color: p.danger, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 8 },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  googleBtn: { padding: 18, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', marginBottom: 20 },
  googleInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  googleIcon: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  googleText: { fontSize: 14, fontWeight: '900', color: '#1f1f1f', letterSpacing: 0.5 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: p.border },
  dividerText: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  signup: { color: p.textMuted, textAlign: 'center', fontSize: 14 },
});
