import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, NeonButton, NeonInput } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { palette, typography, spacing } from '../../src/theme';

export default function Signup() {
  const router = useRouter();
  const signUp = useAuth((s) => s.signUp);
  const [email, setEmail] = useState('');
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
    setBusy(true);
    setError('');
    const err = await signUp(email.trim(), password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <Screen glow="livestock">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>BACK</Text>
          </Pressable>

          <Text style={styles.title}>Create your GAIA account.</Text>
          <Text style={styles.subtitle}>
            Join thousands of farmers across Africa using AI to protect their harvests.
          </Text>

          <View style={{ marginTop: spacing.xxxl }}>
            <NeonInput
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon="E"
            />
            <NeonInput
              label="PASSWORD"
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              secureTextEntry
              icon="P"
            />
            <NeonInput
              label="CONFIRM PASSWORD"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              secureTextEntry
              icon="P"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <NeonButton
            label={busy ? '' : 'CREATE ACCOUNT'}
            onPress={handle}
            loading={busy}
            disabled={!email || !password || !confirm}
          />

          <Text style={styles.terms}>
            By continuing you agree to GAIA Terms of Service and Privacy Policy.
          </Text>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>Already have an account? </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.bottomLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing.xxxl,
  },
  back: { marginBottom: spacing.xl },
  backText: {
    ...typography.micro,
    color: palette.textMuted,
  },
  title: {
    ...typography.title,
    color: palette.text,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: palette.textMuted,
    lineHeight: 22,
  },
  error: {
    color: palette.danger,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontSize: 13,
  },
  terms: {
    ...typography.micro,
    color: palette.textDim,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 16,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  bottomText: { ...typography.body, color: palette.textMuted },
  bottomLink: { ...typography.body, color: palette.neon, fontWeight: '700' },
});
