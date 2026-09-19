import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminWallets() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [adjust, setAdjust] = useState<any | null>(null);
  const [amount, setAmount] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.from('farmer_wallets').select('*').limit(300);
      setRows(data || []);
    } catch {}
    setBusy(false);
  };

  useEffect(() => { if (user?.email?.toLowerCase() === ADMIN_EMAIL) load(); }, [user]);

  const applyAdjustment = async () => {
    if (!adjust) return;
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta === 0) {
      Alert.alert('Enter a non-zero amount');
      return;
    }
    const newBal = Number(adjust.balance || 0) + delta;
    if (newBal < 0) {
      Alert.alert('Invalid', 'Balance would go negative');
      return;
    }
    await supabase.from('farmer_wallets').update({ balance: newBal }).eq('id', adjust.id);
    Alert.alert('Updated', 'New balance: N' + newBal.toLocaleString());
    setAdjust(null);
    setAmount('');
    load();
  };

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const totalBalance = rows.reduce((a, r) => a + Number(r.balance || 0), 0);
  const totalEscrow = rows.reduce((a, r) => a + Number(r.escrow_balance || 0), 0);

  const filtered = search.trim()
    ? rows.filter((r) => (r.virtual_account || '').toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Wallets</Text>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>N{totalBalance.toLocaleString()}</Text>
            <Text style={styles.statLbl}>TOTAL BALANCE</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: palette.warning }]}>N{totalEscrow.toLocaleString()}</Text>
            <Text style={styles.statLbl}>IN ESCROW</Text>
          </View>
        </View>

        <Text style={styles.sub}>{rows.length} wallets</Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by virtual account…"
            placeholderTextColor={palette.textDim}
            style={styles.search}
          />
        </View>

        {busy ? <Text style={styles.loading}>Loading…</Text> : null}

        {filtered.map((r, i) => (
          <Pressable key={i} onPress={() => { setAdjust(r); setAmount(''); }} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.acct}>{r.virtual_account || r.user_id?.slice(0, 16)}</Text>
              <Text style={styles.bank}>{r.account_bank || 'Wema Bank'} · {r.account_name || '—'}</Text>
              {Number(r.escrow_balance) > 0 ? (
                <Text style={styles.escrow}>Escrow: N{Number(r.escrow_balance).toLocaleString()}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.bal}>N{Number(r.balance || 0).toLocaleString()}</Text>
              <Text style={styles.tapHint}>tap to adjust</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Adjust modal */}
      <Modal visible={!!adjust} transparent animationType="slide" onRequestClose={() => setAdjust(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Adjust Balance</Text>
            <Text style={styles.modalAcct}>{adjust?.virtual_account}</Text>
            <Text style={styles.modalBal}>Current: N{Number(adjust?.balance || 0).toLocaleString()}</Text>

            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="+5000 or -2000"
              placeholderTextColor={palette.textDim}
              keyboardType="numbers-and-punctuation"
              style={styles.modalInput}
            />
            <Text style={styles.hint}>Use + to credit, - to debit</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setAdjust(null)} style={styles.cancel}>
                <Text style={styles.cancelTxt}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={applyAdjustment} style={styles.confirm}>
                <Text style={styles.confirmTxt}>APPLY</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  statVal: { fontSize: 20, fontWeight: '900', color: p.neon, letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: p.textMuted, marginTop: 4 },
  sub: { fontSize: 13, color: p.textMuted, marginBottom: 16 },
  searchWrap: { marginBottom: 16 },
  search: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: p.text, fontSize: 14 },
  loading: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  acct: { fontSize: 13, fontWeight: '800', color: p.text, fontFamily: 'monospace' },
  bank: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  escrow: { fontSize: 11, color: p.warning, marginTop: 4, fontWeight: '700' },
  bal: { fontSize: 16, fontWeight: '900', color: p.neon },
  tapHint: { fontSize: 9, color: p.textDim, marginTop: 4, fontStyle: 'italic' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: p.borderHi },
  modalTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 8 },
  modalAcct: { fontSize: 12, color: p.textMuted, fontFamily: 'monospace' },
  modalBal: { fontSize: 15, color: p.neon, fontWeight: '800', marginTop: 6, marginBottom: 20 },
  modalInput: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: p.text, fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 11, color: p.textDim, marginTop: 6, fontStyle: 'italic' },
  cancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  cancelTxt: { fontWeight: '800', color: p.textMuted },
  confirm: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  confirmTxt: { fontWeight: '900', color: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
