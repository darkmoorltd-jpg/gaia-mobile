import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Share } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = keys.join(',');
  const body = rows.map((r) => keys.map((k) => esc(r[k])).join(',')).join('\n');
  return head + '\n' + body;
}

export default function AdminExport() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const [busy, setBusy] = useState('');

  const doExport = async (name: string, rows: any[]) => {
    if (!rows || rows.length === 0) { Alert.alert('Nothing to export'); return; }
    try {
      const csv = toCSV(rows);
      const path = FileSystem.cacheDirectory + name + '-' + Date.now() + '.csv';
      await FileSystem.writeAsStringAsync(path, csv);
      await Share.share({ message: 'GAIA export', url: path });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Try again');
    }
  };

  const exportUsers = async () => {
    setBusy('users');
    const { data, error } = await supabase.rpc('admin_list_users');
    setBusy('');
    if (error) { Alert.alert('Failed', error.message); return; }
    doExport('gaia-users', data || []);
  };

  const exportPayments = async () => {
    setBusy('payments');
    const { data, error } = await supabase.from('payment_history').select('*').order('paid_at', { ascending: false });
    setBusy('');
    if (error) { Alert.alert('Failed', error.message); return; }
    doExport('gaia-payments', data || []);
  };

  const exportOrders = async () => {
    setBusy('orders');
    const { data, error } = await supabase.from('marketplace_orders').select('*').order('created_at', { ascending: false });
    setBusy('');
    if (error) { Alert.alert('Failed', error.message); return; }
    doExport('gaia-orders', data || []);
  };

  const exportListings = async () => {
    setBusy('listings');
    const { data, error } = await supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false });
    setBusy('');
    if (error) { Alert.alert('Failed', error.message); return; }
    doExport('gaia-listings', data || []);
  };

  const exportVerifications = async () => {
    setBusy('kyc');
    const { data, error } = await supabase.from('farmer_verifications').select('*').order('created_at', { ascending: false });
    setBusy('');
    if (error) { Alert.alert('Failed', error.message); return; }
    doExport('gaia-kyc', data || []);
  };

  if (!isAdmin) return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;

  const Btn = ({ k, label, fn }: any) => (
    <Pressable disabled={!!busy} onPress={fn} style={s.btn}>
      {busy === k ? <ActivityIndicator color={palette.obsidian} /> : <Text style={s.btnText}>{label}</Text>}
    </Pressable>
  );

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Export CSV</Text>
        <Text style={s.sub}>Tap any dataset — the file shares to your device</Text>

        <Btn k="users" label="USERS" fn={exportUsers} />
        <Btn k="payments" label="PAYMENT HISTORY" fn={exportPayments} />
        <Btn k="orders" label="MARKETPLACE ORDERS" fn={exportOrders} />
        <Btn k="listings" label="MARKETPLACE LISTINGS" fn={exportListings} />
        <Btn k="kyc" label="KYC SUBMISSIONS" fn={exportVerifications} />

        <Text style={s.hint}>
          CSV files land in the share sheet — save to Drive, WhatsApp, or Files.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  btn: { padding: 18, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginBottom: 10 },
  btnText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  hint: { fontSize: 11, color: p.textMuted, fontStyle: 'italic', marginTop: 16, lineHeight: 16 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
