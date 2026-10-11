import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

export default function ForgotPassword() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const resetPassword = useAuth((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const err = await resetPassword(email.trim());
    setBusy(false);
    if (err) { Alert.alert('Reset failed', err); return; }
    setDone(true);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Forgot your password?</Text>
        <Text style={styles.subtitle}>Enter the email you used to sign up. We will send you a link to reset your password.</Text>

        {done ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>OK</Text>
            <Text style={styles.doneTitle}>Check your email</Text>
            <Text style={styles.doneBody}>
              If an account exists for {email}, a reset link is on its way. Open the link on this phone to set a new password.
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.cta}>
              <Text style={styles.ctaText}>BACK TO SIGN IN</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrap}>
              <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={palette.textDim} style={styles.input} />
            </View>
            <Pressable onPress={submit} disabled={busy || !email.trim()} style={[styles.cta, (busy || !email.trim()) && { opacity: 0.4 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SEND RESET LINK</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 8, lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16 },
  input: { paddingVertical: 14, color: p.text, fontSize: 15 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 8 },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  doneBox: { padding: 24, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.borderHi, alignItems: 'center' },
  doneIcon: { fontSize: 18, color: p.neon, fontWeight: '900', marginBottom: 12, letterSpacing: 2 },
  doneTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 8 },
  doneBody: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
});
