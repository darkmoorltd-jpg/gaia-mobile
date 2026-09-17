
import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, NeonButton, NeonInput, Pill } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { palette, typography, spacing } from '../../src/theme';

export default function Login() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setBusy(true);
    setError('');
    const err = await signIn(email.trim(), password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <Screen glow="crops">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.leaf}>🌱</Text>
            <Text style={styles.brand}>GAIA</Text>
            <Pill label="AI Agritech" />
          </View>

          <Text style={styles.title}>Welcome back.</Text>
          <Text style={styles.subtitle}>
            Sign in to continue diagnosing and protecting your farm.
          </Text>

          <View style={{ marginTop: spacing.xxl }}>
            <NeonInput
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon="✉"
            />
            <NeonInput
              label="PASSWORD"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              icon="🔒"
            />

            <Pressable onPress={() => {}}>
              <Text style={styles.forgot}>FORGOT PASSWORD?</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <NeonButton
            label={busy ? '' : 'SIGN IN'}
            onPress={handleLogin}
            loading={busy}
            disabled={!email || !password}
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.divider} />
          </View>

          <Pressable style={styles.googleBtn}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleText}>Google</Text>
          </Pressable>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>New here? </Text>
            <Pressable onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.bottomLink}>Create account</Text>
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
    paddingTop: 80,
    paddingBottom: spacing.xxxl,
  },
  header: { alignItems: 'center', marginBottom: spacing.xxxl },
  leaf: { fontSize: 56, marginBottom: 8 },
  brand: {
    fontSize: 32,
    fontWeight: '900',
    color: palette.text,
    letterSpacing: 8,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: palette.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: palette.textMuted,
    lineHeight: 22,
  },
  forgot: {
    ...typography.micro,
    color: palette.neon,
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: spacing.lg,
  },
  error: {
    color: palette.danger,
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    ...typography.micro,
    color: palette.textDim,
    marginHorizontal: spacing.md,
  },
  googleBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  googleText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 15,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  bottomText: {
    ...typography.body,
    color: palette.textMuted,
  },
  bottomLink: {
    ...typography.body,
    color: palette.neon,
    fontWeight: '700',
  },
});
