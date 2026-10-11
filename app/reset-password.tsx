import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';

export default function ResetPassword() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const updatePassword = useAuth((s) => s.updatePassword);
  const signOut = useAuth((s) => s.signOut);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw1.length < 6) { Alert.alert('Too short', 'Password must be at least 6 characters.'); return; }
    if (pw1 !== pw2) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setBusy(true);
    const err = await updatePassword(pw1);
    setBusy(false);
    if (err) { Alert.alert('Reset failed', err); return; }
    Alert.alert('Password updated', 'You can now sign in with your new password.', [
      { text: 'OK', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Choose something strong that you will remember.</Text>
        <Text style={styles.label}>NEW PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput value={pw1} onChangeText={setPw1} secureTextEntry placeholder="at least 6 characters" placeholderTextColor={palette.textDim} style={styles.input} />
        </View>
        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput value={pw2} onChangeText={setPw2} secureTextEntry placeholder="type it again" placeholderTextColor={palette.textDim} style={styles.input} />
        </View>
        <Pressable onPress={submit} disabled={busy || !pw1 || !pw2} style={[styles.cta, (busy || !pw1 || !pw2) && { opacity: 0.4 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>UPDATE PASSWORD</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 24, paddingTop: 100, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 8, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16 },
  input: { paddingVertical: 14, color: p.text, fontSize: 15 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 8 },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
