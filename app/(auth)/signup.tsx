import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import { registerForPushNotifications } from '../../src/utils/push';

function normalizePhone(input: string): string {
  let p = (input || '').trim().replace(/[\s\-\(\)]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '234' + p.slice(1);
  else if (!p.startsWith('234')) p = '234' + p;
  return p;
}

export default function Signup() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const signUp = useAuth((s) => s.signUp);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const err = await signUp(email.trim().toLowerCase(), password);
      if (err) throw new Error(err);

      // Save profile (with phone + names)
      const currentUser = useAuth.getState().user;
      if (currentUser) {
        await supabase.from('user_profiles').upsert(
          {
            user_id: currentUser.id,
            email: email.trim().toLowerCase(),
            phone: phone.trim() ? normalizePhone(phone) : null,
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

        registerForPushNotifications(currentUser.id);
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message || 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>Create your{'\n'}GAIA account.</Text>
        <Text style={styles.subtitle}>
          Join thousands of farmers across Africa using AI to protect their harvests.
        </Text>

        <Text style={styles.label}>EMAIL</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={palette.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <Text style={styles.label}>PHONE (NIGERIA)</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="0803 123 4567"
            placeholderTextColor={palette.textDim}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>FIRST NAME</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Musa"
                placeholderTextColor={palette.textDim}
                style={styles.input}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>LAST NAME</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Ibrahim"
                placeholderTextColor={palette.textDim}
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 6 characters"
            placeholderTextColor={palette.textDim}
            secureTextEntry
            style={styles.input}
          />
        </View>

        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat password"
            placeholderTextColor={palette.textDim}
            secureTextEntry
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handle}
          disabled={busy || !email || !password || !confirm}
          style={[styles.cta, (busy || !email || !password || !confirm) && { opacity: 0.4 }]}
        >
          {busy
            ? <ActivityIndicator color={palette.obsidian} />
            : <Text style={styles.ctaText}>CREATE ACCOUNT</Text>}
        </Pressable>

        <Text style={styles.terms}>
          By continuing you agree to GAIA's Terms of Service and Privacy Policy.
        </Text>

        <View style={styles.bottom}>
          <Text style={styles.bottomText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.bottomLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.xxxl },
    back: { marginBottom: spacing.lg },
    backText: { ...typography.micro, color: palette.textMuted },
    title: { fontSize: 30, fontWeight: '900', color: palette.text, letterSpacing: -1, marginBottom: spacing.md, lineHeight: 38 },
    subtitle: { ...typography.body, color: palette.textMuted, lineHeight: 22, marginBottom: spacing.xl },
    label: { ...typography.micro, color: palette.textMuted, marginBottom: 6, marginTop: spacing.sm },
    inputWrap: {
      borderWidth: 1.5, borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    input: { paddingVertical: 14, color: palette.text, fontSize: 15 },
    row: { flexDirection: 'row', gap: spacing.md },
    error: { color: palette.danger, textAlign: 'center', marginVertical: spacing.md, fontSize: 13 },
    cta: {
      padding: 18, borderRadius: radius.md,
      backgroundColor: palette.neon, alignItems: 'center', marginTop: spacing.md,
    },
    ctaText: { fontSize: 15, fontWeight: '900', color: palette.obsidian, letterSpacing: 1 },
    terms: { ...typography.micro, color: palette.textDim, textAlign: 'center', marginTop: spacing.xl, lineHeight: 16 },
    bottom: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
    bottomText: { ...typography.body, color: palette.textMuted },
    bottomLink: { ...typography.body, color: palette.neon, fontWeight: '700' },
  });
