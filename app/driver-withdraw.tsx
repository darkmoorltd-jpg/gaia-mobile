import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function DriverWithdraw() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [{ data: bal }, { data: prof }, { data: hist }] = await Promise.all([
      supabase.rpc('driver_wallet_balance'),
      supabase.from('driver_profiles').select('bank_name, bank_account_number, bank_account_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('driver_withdrawals').select('*').eq('driver_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setBalance(Number(bal) || 0);
    setProfile(prof);
    setHistory(hist || []);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 5000) return Alert.alert('Minimum ₦5,000');
    if (amt > balance) return Alert.alert('Insufficient balance');
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('request_driver_withdrawal', { p_amount: amt });
      if (error) throw error;
      Alert.alert('Submitted', 'Admin will process within 48 hours.');
      setAmount(''); await load();
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setSubmitting(false); }
  };

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Withdraw</Text>
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>AVAILABLE</Text>
          <Text style={styles.walletValue}>₦{balance.toLocaleString()}</Text>
        </View>
        <Text style={styles.sectionLabel}>BANK ON FILE</Text>
        <View style={styles.card}>
          <Text style={styles.body}>{profile?.bank_name || '—'}</Text>
          <Text style={styles.body}>{profile?.bank_account_number || '—'}</Text>
          <Text style={styles.body}>{profile?.bank_account_name || '—'}</Text>
        </View>
        <Text style={styles.sectionLabel}>AMOUNT (₦)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Min 5,000" placeholderTextColor={palette.textDim} style={styles.input} />
        <Pressable onPress={submit} disabled={submitting || !profile} style={[styles.btn, (submitting || !profile) && { opacity: 0.5 }]}>
          {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>REQUEST WITHDRAWAL</Text>}
        </Pressable>
        <Text style={styles.sectionLabel}>HISTORY</Text>
        {history.length === 0 ? <Text style={styles.hint}>No withdrawals yet.</Text> : history.map(w => {
          const color = w.status === 'completed' ? palette.neon : w.status === 'rejected' ? '#ff3b5c' : '#ffb300';
          return (
            <View key={w.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.body}>₦{Number(w.amount_naira).toLocaleString()}</Text>
                <Text style={[styles.status, { color }]}>{w.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.hint}>{new Date(w.created_at).toLocaleString()}</Text>
              {w.admin_notes ? <Text style={styles.hint}>"{w.admin_notes}"</Text> : null}
            </View>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  walletCard: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: p.neon, marginVertical: 20 },
  walletLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  walletValue: { fontSize: 40, fontWeight: '900', color: p.text, marginTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  body: { fontSize: 14, color: p.text, marginBottom: 2 },
  hint: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 16 },
  btn: { backgroundColor: p.neon, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});