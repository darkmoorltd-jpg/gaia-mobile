import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import {
  checkBiometricSupport, enableBiometric, isBiometricEnabled,
  promptBiometric, getBiometricEmail,
} from '../../src/utils/biometric';
import { registerForPushNotifications } from '../../src/utils/push';

export default function Login() {
  const router = useRouter();
  const { palette } = useTheme();
  const signIn = useAuth((s) => s.signIn);
  const user = useAuth((s) => s.user);
  const styles = createStyles(palette);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioType, setBioType] = useState<string | null>(null);
  const [bioEmail, setBioEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const support = await checkBiometricSupport();
      setBioAvailable(support.available && support.enrolled);
      setBioType(support.type);
      const enabled = await isBiometricEnabled();
      setBioEnabled(enabled);
      const em = await getBiometricEmail();
      setBioEmail(em);
    })();
  }, []);

  useEffect(() => {
    if (user) {
      registerForPushNotifications(user.id);
    }
  }, [user]);

  const handleBiometricLogin = async () => {
    const ok = await promptBiometric();
    if (ok && bioEmail) {
      Alert.alert('Biometric verified', 'Please enter your password to continue.');
      setEmail(bioEmail);
    } else {
      Alert.alert('Authentication failed', 'Try again or use password.');
    }
  };

  const handleLogin = async () => {
    setBusy(true);
    setError('');
    const err = await signIn(email.trim(), password);
    if (err) setError(err);
    setBusy(false);
  };

  const offerBiometricSetup = async () => {
    if (!bioAvailable || !user) return;
    const enabled = await enableBiometric(user.email || '');
    if (enabled) {
      setBioEnabled(true);
      Alert.alert('Success', bioType + ' login enabled.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.leaf}>GAIA</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue protecting your farm</Text>

        <View style={{ marginTop: 32 }}>
          <Text style={styles.label}>EMAIL</Text>
          <View style={styles.inputWrap}>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={palette.textDim} style={styles.input} />
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputWrap}>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="password" placeholderTextColor={palette.textDim} style={styles.input} />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={handleLogin} disabled={busy || !email || !password} style={[styles.cta, (busy || !email || !password) && { opacity: 0.4 }]}>
          <Text style={styles.ctaText}>{busy ? 'SIGNING IN...' : 'SIGN IN'}</Text>
        </Pressable>

        {bioAvailable && bioEnabled ? (
          <Pressable onPress={handleBiometricLogin} style={styles.bioBtn}>
            <Text style={styles.bioText}>USE {bioType?.toUpperCase()}</Text>
          </Pressable>
        ) : null}

        {bioAvailable && !bioEnabled && user ? (
          <Pressable onPress={offerBiometricSetup} style={styles.bioBtnOutline}>
            <Text style={styles.bioTextOutline}>ENABLE {bioType?.toUpperCase()}</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/(auth)/signup')} style={{ marginTop: 24 }}>
          <Text style={styles.signup}>Don't have an account? Sign up</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { TextInput } from 'react-native';

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 24, paddingTop: 100, paddingBottom: 40 },
  leaf: { fontSize: 40, fontWeight: '900', color: p.neon, letterSpacing: 8, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: p.textMuted, marginTop: 6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16 },
  input: { paddingVertical: 14, color: p.text, fontSize: 15 },
  error: { color: p.danger, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 12 },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  bioBtn: { marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  bioText: { color: p.neon, fontWeight: '900', letterSpacing: 1 },
  bioBtnOutline: { marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  bioTextOutline: { color: p.text, fontWeight: '800', letterSpacing: 1 },
  signup: { color: p.textMuted, textAlign: 'center', fontSize: 14 },
});
