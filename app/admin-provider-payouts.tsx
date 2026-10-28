import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmt = (s?: string) => s ? new Date(s).toLocaleString() : '—';

export default function AdminProviderPayouts() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [reject, setReject] = useState<any>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('admin_list_provider_withdrawals', { p_status: 'all' });
    setRows(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markPaid = (w: any) => {
    Alert.alert('Mark paid?', money(w.amount) + ' to ' + w.business_name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirmed', onPress: async () => {
        const { error } = await supabase.rpc('admin_settle_provider_withdrawal', {
          p_id: w.id, p_status: 'paid', p_notes: 'Paid via bank transfer',
        });
        if (error) Alert.alert('Failed', error.message); else load();
      }},
    ]);
  };

  const doReject = async () => {
    if (!reject || !reason.trim()) return;
    const { error } = await supabase.rpc('admin_settle_provider_withdrawal', {
      p_id: reject.id, p_status: 'rejected', p_notes: reason.trim(),
    });
    if (error) Alert.alert('Failed', error.message);
    else { setReject(null); setReason(''); load(); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Provider Payouts</Text>
        <Text style={styles.sub}>{rows.length} withdrawal request(s)</Text>

        {busy && rows.length === 0 ? <ActivityIndicator color="#b388ff" /> : null}
        {!busy && rows.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No withdrawal requests yet.</Text></View>
        ) : null}

        {rows.map((w) => {
          const c = w.status === 'paid' ? '#00ff88'
            : w.status === 'rejected' ? '#ff3b5c'
            : '#ffb300';
          return (
            <View key={w.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.name}>{w.business_name}</Text>
                <Text style={[styles.chip, { color: c, borderColor: c }]}>{String(w.status || '').toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>{w.provider_email}</Text>
              <Text style={styles.amt}>{money(w.amount)}</Text>
              <Text style={styles.meta}>🏦 {w.bank_name}</Text>
              <Text style={styles.meta}>Acct: {w.account_number} · {w.account_name}</Text>
              <Text style={styles.meta}>Requested: {fmt(w.created_at)}</Text>
              {w.processed_at ? <Text style={styles.meta}>Processed: {fmt(w.processed_at)}</Text> : null}
              {w.admin_notes ? <Text style={styles.meta}>Notes: {w.admin_notes}</Text> : null}

              {w.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable onPress={() => markPaid(w)} style={[styles.btn, { borderColor: '#00ff88' }]}>
                    <Text style={[styles.btnText, { color: '#00ff88' }]}>MARK PAID</Text>
                  </Pressable>
                  <Pressable onPress={() => setReject(w)} style={[styles.btn, { borderColor: '#ff3b5c' }]}>
                    <Text style={[styles.btnText, { color: '#ff3b5c' }]}>REJECT</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!reject} animationType="slide" transparent onRequestClose={() => setReject(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>Reject Payout</Text>
            <Text style={styles.meta}>{reject?.business_name} · {money(reject?.amount)}</Text>
            <Text style={styles.label}>REASON</Text>
            <TextInput value={reason} onChangeText={setReason} multiline style={[styles.input, { minHeight: 80 }]} placeholder="e.g. Bank details do not match business name" placeholderTextColor={palette.textDim} />
            <Pressable onPress={doReject} style={styles.cta}>
              <Text style={styles.ctaText}>REJECT</Text>
            </Pressable>
            <Pressable onPress={() => setReject(null)} style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }]}>
              <Text style={[styles.ctaText, { color: palette.text }]}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text, flex: 1 },
  chip: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, letterSpacing: 0.5 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  amt: { fontSize: 22, fontWeight: '900', color: '#b388ff', marginTop: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  btnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: '#ff3b5c', alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
