import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { sendToUser, fmtN } from '../src/utils/wallet';

export default function WalletSend() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [ident, setIdent] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const submitTimer = useRef<any>(null);

  useEffect(() => {
    if (submitTimer.current) { clearTimeout(submitTimer.current); submitTimer.current = null; }
    if (busy) return;
    if (!/^[0-9]{4}$/.test(pin)) return;
    if (!ident.trim() || !amount) return;
    submitTimer.current = setTimeout(() => { submit(); }, 350);
    return () => { if (submitTimer.current) clearTimeout(submitTimer.current); };
  }, [pin, ident, amount, busy]);

  const submit = async () => {
    const amt = Number(amount);
    if (!ident.trim()) { Alert.alert('Missing recipient'); return; }
    if (!amt || amt < 10) { Alert.alert('Minimum N10'); return; }
    if (!/^[0-9]{4}$/.test(pin)) { Alert.alert('Enter 4-digit PIN'); return; }
    Alert.alert('Send ' + fmtN(amt, 2) + '?', 'To ' + ident.trim(), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'SEND', onPress: async () => {
        setBusy(true);
        try {
          const r = await sendToUser(ident.trim(), amt, note.trim() || undefined, pin);
          Alert.alert('Sent', 'To ' + r.recipient + '. New balance ' + fmtN(r.balance, 2), [{ text: 'OK', onPress: () => router.back() }]);
        } catch (e: any) {
          Alert.alert('Failed', e.message || 'Try again');
        } finally { setBusy(false); }
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Send Money</Text>
        <Text style={styles.sub}>To any GAIA user by email or phone</Text>

        <Text style={styles.label}>RECIPIENT EMAIL OR PHONE</Text>
        <TextInput value={ident} onChangeText={setIdent} placeholder="name@email.com or 08012345678" placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>AMOUNT (N)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="1000" placeholderTextColor={palette.textDim} style={[styles.input, { fontSize: 22, fontWeight: '900' }]} />

        <Text style={styles.label}>NOTE (OPTIONAL)</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="What is it for?" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>4-DIGIT PIN</Text>
        <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={palette.textDim} style={[styles.input, { fontSize: 22, letterSpacing: 8, textAlign: 'center' }]} />

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>SEND INSTANTLY</Text>}
        </Pressable>

        <Text style={styles.hint}>Transfers between GAIA users are instant and free.</Text>
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { marginTop: 24, padding: 20, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  hint: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
