import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { fetchBanks, resolveAccount, withdrawToBank, fmtN } from '../src/utils/wallet';

export default function WalletWithdraw() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [acct, setAcct] = useState('');
  const [acctName, setAcctName] = useState('');
  const [amount, setAmount] = useState('');
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => { fetchBanks().then(setBanks); }, []);

  const onResolve = async () => {
    if (!bankCode || acct.length !== 10) { Alert.alert('Pick bank and 10-digit account'); return; }
    setResolving(true);
    try {
      const r = await resolveAccount(acct, bankCode);
      setAcctName(r.account_name);
    } catch (e: any) {
      Alert.alert('Could not resolve', e.message || 'Check account');
      setAcctName('');
    } finally { setResolving(false); }
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!acctName) { Alert.alert('Verify account first'); return; }
    if (!amt || amt < 500) { Alert.alert('Minimum N500'); return; }
    if (!/^[0-9]{4}$/.test(pin)) { Alert.alert('Enter 4-digit PIN'); return; }
    Alert.alert('Withdraw ' + fmtN(amt, 2) + '?', 'To ' + acctName + ' ' + acct, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'WITHDRAW', onPress: async () => {
        setBusy(true);
        try {
          await withdrawToBank({ account_number: acct, bank_code: bankCode, account_name: acctName, amount_naira: amt, pin: pin });
          Alert.alert('Sent to bank', 'Your money is on its way. Settlement typically takes a few minutes.', [{ text: 'OK', onPress: () => router.back() }]);
        } catch (e: any) {
          Alert.alert('Failed', e.message || 'Try again');
        } finally { setBusy(false); }
      }},
    ]);
  };

  const filtered = search ? banks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase())) : banks;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Withdraw</Text>
        <Text style={styles.sub}>To any Nigerian bank account</Text>

        <Text style={styles.label}>SEARCH BANK</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="GTBank, Access, Kuda..." placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" />

        <Text style={styles.label}>SELECT BANK</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {filtered.slice(0, 40).map((b) => (
              <Pressable key={b.code} onPress={() => { setBankCode(b.code); setAcctName(''); }} style={[styles.chip, bankCode === b.code && styles.chipOn]}>
                <Text style={[styles.chipTxt, bankCode === b.code && styles.chipTxtOn]}>{b.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>ACCOUNT NUMBER</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={acct} onChangeText={(v) => { setAcct(v.replace(/[^0-9]/g, '')); setAcctName(''); }} keyboardType="number-pad" maxLength={10} placeholder="0123456789" placeholderTextColor={palette.textDim} style={[styles.input, { flex: 1 }]} />
          <Pressable onPress={onResolve} disabled={resolving || acct.length !== 10 || !bankCode} style={[styles.resolveBtn, (resolving || acct.length !== 10 || !bankCode) && { opacity: 0.4 }]}>
            {resolving ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.resolveTxt}>CHECK</Text>}
          </Pressable>
        </View>

        {acctName ? (
          <View style={styles.acctCard}>
            <Text style={styles.acctLbl}>ACCOUNT NAME</Text>
            <Text style={styles.acctVal}>{acctName}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>AMOUNT (N)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="5000" placeholderTextColor={palette.textDim} style={[styles.input, { fontSize: 22, fontWeight: '900' }]} />

        <Text style={styles.label}>4-DIGIT PIN</Text>
        <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={palette.textDim} style={[styles.input, { fontSize: 22, letterSpacing: 8, textAlign: 'center' }]} />

        <Pressable onPress={submit} disabled={busy || !acctName} style={[styles.cta, (busy || !acctName) && { opacity: 0.4 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>WITHDRAW TO BANK</Text>}
        </Pressable>

        <Text style={styles.hint}>Withdrawals typically settle within minutes. Minimum N500.</Text>
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
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  chipTxtOn: { color: p.neon },
  resolveBtn: { paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', justifyContent: 'center' },
  resolveTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  acctCard: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  acctLbl: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5 },
  acctVal: { fontSize: 15, fontWeight: '900', color: p.neon, marginTop: 4, textTransform: 'uppercase' },
  cta: { marginTop: 24, padding: 20, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  hint: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
