import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Alert,
  ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import {
  setWalletPin, resetPinWithPassword, hasWalletPin, verifyPin,
} from '../src/utils/wallet';

export default function WalletSetPin() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [checking, setChecking] = useState(true);
  const [alreadyHas, setAlreadyHas] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [resetting, setResetting] = useState(false);

  const submitTimer = useRef<any>(null);
  const resetTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const has = await hasWalletPin();
      setAlreadyHas(has);
      setChecking(false);
    })();
  }, []);

  // Auto-submit when all fields valid
  useEffect(() => {
    if (submitTimer.current) { clearTimeout(submitTimer.current); submitTimer.current = null; }
    if (busy || checking) return;
    const currOk = !alreadyHas || /^[0-9]{4}$/.test(currentPin);
    const newOk = /^[0-9]{4}$/.test(pin);
    const matchOk = pin === confirm;
    if (currOk && newOk && matchOk) {
      submitTimer.current = setTimeout(() => { submit(); }, 350);
    }
    return () => { if (submitTimer.current) clearTimeout(submitTimer.current); };
  }, [currentPin, pin, confirm, alreadyHas, checking, busy]);

  // Auto-submit forgot-pin reset
  useEffect(() => {
    if (resetTimer.current) { clearTimeout(resetTimer.current); resetTimer.current = null; }
    if (resetting) return;
    if (password.length >= 6 && /^[0-9]{4}$/.test(newPin) && newPin === confirmNew) {
      resetTimer.current = setTimeout(() => { doReset(); }, 400);
    }
    return () => { if (resetTimer.current) clearTimeout(resetTimer.current); };
  }, [password, newPin, confirmNew, resetting]);

  const submit = async () => {
    if (busy) return;
    if (alreadyHas && !/^[0-9]{4}$/.test(currentPin)) {
      Alert.alert('Enter your current 4-digit PIN');
      return;
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      Alert.alert('New PIN must be 4 digits');
      return;
    }
    if (pin !== confirm) {
      Alert.alert('New PINs do not match');
      return;
    }
    setBusy(true);
    try {
      if (alreadyHas) {
        const ok = await verifyPin(currentPin);
        if (!ok) {
          Alert.alert('Incorrect current PIN');
          setCurrentPin('');
          setBusy(false);
          return;
        }
      }
      await setWalletPin(pin);
      Alert.alert(
        alreadyHas ? 'PIN changed' : 'PIN set',
        'You can now send, withdraw, and buy scans from your wallet.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Try again');
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (resetting) return;
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
      setResetting(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  // Visual progress: how many valid inputs the user has filled
  const filled = (alreadyHas && /^[0-9]{4}$/.test(currentPin) ? 1 : 0)
    + (/^[0-9]{4}$/.test(pin) ? 1 : 0)
    + (pin.length === 4 && pin === confirm ? 1 : 0);
  const total = alreadyHas ? 3 : 2;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>{alreadyHas ? 'Change Transfer PIN' : 'Set Transfer PIN'}</Text>
        <Text style={styles.sub}>
          {alreadyHas
            ? 'Confirm your current PIN, then choose a new one.'
            : 'A 4-digit PIN secures every wallet transaction. Fills automatically once both PINs match.'}
        </Text>

        <View style={styles.progressRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.progressDot, i < filled && styles.progressDotOn]} />
          ))}
        </View>

        {alreadyHas ? (
          <>
            <Text style={styles.label}>CURRENT PIN</Text>
            <TextInput
              value={currentPin}
              onChangeText={(v) => setCurrentPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />
          </>
        ) : null}

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

        <Text style={styles.label}>CONFIRM NEW PIN</Text>
        <TextInput
          value={confirm}
          onChangeText={(v) => setConfirm(v.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          placeholder="0000"
          placeholderTextColor={palette.textDim}
          style={[
            styles.input,
            pin.length === 4 && confirm.length === 4 && pin !== confirm && styles.inputError,
          ]}
        />
        {pin.length === 4 && confirm.length === 4 && pin !== confirm ? (
          <Text style={styles.errorHint}>PINs do not match</Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy || pin.length !== 4 || confirm.length !== 4 || pin !== confirm || (alreadyHas && currentPin.length !== 4)}
          style={[styles.cta, (busy || pin.length !== 4 || confirm.length !== 4 || pin !== confirm || (alreadyHas && currentPin.length !== 4)) && { opacity: 0.4 }]}
        >
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>{alreadyHas ? 'CHANGE PIN' : 'SAVE PIN'}</Text>}
        </Pressable>

        <Text style={styles.autoHint}>
          {busy ? 'Saving…' : (alreadyHas ? 'Auto-submits once all 3 fields are 4 digits' : 'Auto-submits once both PINs match')}
        </Text>

        <Pressable onPress={() => setShowForgot(true)} style={styles.forgotLink}>
          <Text style={styles.forgotTxt}>Forgot your PIN?</Text>
        </Pressable>

        <Text style={styles.hint}>Never share this PIN. GAIA staff will never ask for it.</Text>
      </ScrollView>

      <Modal visible={showForgot} animationType="slide" transparent onRequestClose={() => setShowForgot(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reset PIN</Text>
            <Text style={styles.modalSub}>Verify with your login password. Auto-submits when all fields valid.</Text>

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
              style={[styles.input,
                newPin.length === 4 && confirmNew.length === 4 && newPin !== confirmNew && styles.inputError]}
            />

            <Pressable
              onPress={doReset}
              disabled={resetting || !password || newPin.length !== 4 || confirmNew.length !== 4 || newPin !== confirmNew}
              style={[styles.cta, { marginTop: 20 }, (resetting || !password || newPin.length !== 4 || confirmNew.length !== 4 || newPin !== confirmNew) && { opacity: 0.4 }]}
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
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'center' },
  progressDot: { width: 44, height: 5, borderRadius: 3, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  progressDotOn: { backgroundColor: p.neon, borderColor: p.neon },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 22, letterSpacing: 12, textAlign: 'center', fontWeight: '900' },
  inputPlain: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  inputError: { borderColor: '#ff3b5c' },
  errorHint: { fontSize: 11, color: '#ff3b5c', textAlign: 'center', marginTop: 6, fontWeight: '700' },
  cta: { marginTop: 24, padding: 20, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  autoHint: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
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
