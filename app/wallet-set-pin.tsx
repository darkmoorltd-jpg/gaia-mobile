import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Alert,
  ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { setWalletPin, resetPinWithPassword } from '../src/utils/wallet';

export default function WalletSetPin() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [resetting, setResetting] = useState(false);

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

  const doReset = async () => {
    if (!password) { Alert.alert('Enter your login password'); return; }
    if (!/^[0-9]{4}$/.test(newPin)) { Alert.alert('PIN must be 4 digits'); return; }
    if (newPin !== confirmNew) { Alert.alert('PINs do not match'); return; }
    setResetting(true);
    try {
      await resetPinWithPassword(password, newPin);
      setShowForgot(false);
      setPassword(''); setNewPin(''); setConfirmNew('');
      Alert.alert('PIN reset', 'Your new PIN is ready to use.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Reset failed', e.message || 'Check your password');
    } finally { setResetting(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Set Transfer PIN</Text>
        <Text style={styles.sub}>A 4-digit PIN secures every wallet transaction.</Text>

        <Text style={styles.label}>NEW 4-DIGIT PIN</Text>
        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          placeholder="0000"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>CONFIRM PIN</Text>
        <TextInput
          value={confirm}
          onChangeText={(v) => setConfirm(v.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          placeholder="0000"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Pressable
          onPress={submit}
          disabled={busy || pin.length !== 4 || confirm.length !== 4}
          style={[styles.cta, (busy || pin.length !== 4 || confirm.length !== 4) && { opacity: 0.4 }]}
        >
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>SAVE PIN</Text>}
        </Pressable>

        <Pressable onPress={() => setShowForgot(true)} style={styles.forgotLink}>
          <Text style={styles.forgotTxt}>Forgot your PIN?</Text>
        </Pressable>

        <Text style={styles.hint}>Never share this PIN. GAIA staff will never ask for it.</Text>
      </ScrollView>

      <Modal visible={showForgot} animationType="slide" transparent onRequestClose={() => setShowForgot(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reset PIN</Text>
            <Text style={styles.modalSub}>Verify with your login password to set a new PIN.</Text>

            <Text style={styles.label}>LOGIN PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your account password"
              placeholderTextColor={palette.textDim}
              style={styles.inputPlain}
            />

            <Text style={styles.label}>NEW 4-DIGIT PIN</Text>
            <TextInput
              value={newPin}
              onChangeText={(v) => setNewPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Text style={styles.label}>CONFIRM NEW PIN</Text>
            <TextInput
              value={confirmNew}
              onChangeText={(v) => setConfirmNew(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />

            <Pressable
              onPress={doReset}
              disabled={resetting || !password || newPin.length !== 4 || confirmNew.length !== 4}
              style={[styles.cta, { marginTop: 20 }, (resetting || !password || newPin.length !== 4 || confirmNew.length !== 4) && { opacity: 0.4 }]}
            >
              {resetting ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>RESET PIN</Text>}
            </Pressable>

            <Pressable onPress={() => setShowForgot(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 22, letterSpacing: 12, textAlign: 'center', fontWeight: '900' },
  inputPlain: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { marginTop: 24, padding: 20, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  forgotLink: { marginTop: 16, alignItems: 'center', padding: 12 },
  forgotTxt: { fontSize: 13, fontWeight: '700', color: p.neon, textDecorationLine: 'underline' },
  hint: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.obsidian, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  modalSub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 8 },
  modalCancel: { marginTop: 8, padding: 14, alignItems: 'center' },
  modalCancelTxt: { fontSize: 13, color: p.textMuted, fontWeight: '700' },
});
