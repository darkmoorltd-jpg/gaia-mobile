import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { setWalletPin } from '../src/utils/wallet';

export default function WalletSetPin() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^[0-9]{4}$/.test(pin)) { Alert.alert('PIN must be 4 digits'); return; }
    if (pin !== confirm) { Alert.alert('PINs do not match'); return; }
    setBusy(true);
    try {
      await setWalletPin(pin);
      Alert.alert('PIN set', 'You can now send, withdraw, and buy scans from your wallet.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Try again');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
      <Text style={styles.title}>Set Transfer PIN</Text>
      <Text style={styles.sub}>A 4-digit PIN secures every wallet transaction.</Text>

      <Text style={styles.label}>NEW 4-DIGIT PIN</Text>
      <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={palette.textDim} style={styles.input} />

      <Text style={styles.label}>CONFIRM PIN</Text>
      <TextInput value={confirm} onChangeText={(v) => setConfirm(v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={palette.textDim} style={styles.input} />

      <Pressable onPress={submit} disabled={busy || pin.length !== 4 || confirm.length !== 4} style={[styles.cta, (busy || pin.length !== 4 || confirm.length !== 4) && { opacity: 0.4 }]}>
        {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>SAVE PIN</Text>}
      </Pressable>

      <Text style={styles.hint}>Never share this PIN. GAIA staff will never ask for it.</Text>
    </ScrollView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 22, letterSpacing: 12, textAlign: 'center', fontWeight: '900' },
  cta: { marginTop: 24, padding: 20, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  hint: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
