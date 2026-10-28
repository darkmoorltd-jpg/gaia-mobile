import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { categoryLabel } from '../src/data/input_categories';

export default function AdminInputProviders() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_list_input_providers', { p_status: 'all' });
    setRows(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = (id: string) => {
    Alert.alert('Approve provider?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        const { error } = await supabase.rpc('admin_approve_input_provider', { p_user_id: id });
        if (error) Alert.alert('Failed', error.message); else load();
      }},
    ]);
  };

  const doReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    const { error } = await supabase.rpc('admin_reject_input_provider', { p_user_id: rejectModal.user_id, p_reason: rejectReason.trim() });
    if (error) Alert.alert('Failed', error.message);
    else { setRejectModal(null); setRejectReason(''); load(); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Input Providers</Text>
        <Text style={styles.sub}>{rows.length} total</Text>

        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}

        {rows.map((r) => {
          const c = r.status === 'active' ? '#00ff88' : r.status === 'rejected' ? '#ff3b5c' : '#ffb300';
          return (
            <View key={r.user_id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.name}>{r.business_name}</Text>
                <Text style={[styles.chip, { color: c, borderColor: c }]}>{String(r.status || '').toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>{r.account_email}</Text>
              <Text style={styles.meta}>{r.state} · {r.lga} · {r.city}</Text>
              <Text style={styles.meta}>Categories: {(r.categories || []).map(categoryLabel).join(', ')}</Text>
              <Text style={styles.meta}>Phone: {r.phone} · WA: {r.whatsapp}</Text>
              {r.business_reg_number ? <Text style={styles.meta}>CAC: {r.business_reg_number}</Text> : null}
              {r.description ? <Text style={styles.meta} numberOfLines={3}>"{r.description}"</Text> : null}

              {r.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable onPress={() => approve(r.user_id)} style={[styles.btn, { borderColor: '#00ff88' }]}>
                    <Text style={[styles.btnText, { color: '#00ff88' }]}>APPROVE</Text>
                  </Pressable>
                  <Pressable onPress={() => setRejectModal(r)} style={[styles.btn, { borderColor: '#ff3b5c' }]}>
                    <Text style={[styles.btnText, { color: '#ff3b5c' }]}>REJECT</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!rejectModal} animationType="slide" transparent onRequestClose={() => setRejectModal(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>Reject</Text>
            <Text style={styles.meta}>{rejectModal?.business_name}</Text>
            <Text style={styles.label}>REASON</Text>
            <TextInput value={rejectReason} onChangeText={setRejectReason} multiline style={[styles.input, { minHeight: 80 }]} placeholderTextColor={palette.textDim} placeholder="e.g. CAC number invalid" />
            <Pressable onPress={doReject} style={styles.cta}>
              <Text style={styles.ctaText}>REJECT APPLICATION</Text>
            </Pressable>
            <Pressable onPress={() => setRejectModal(null)} style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }]}>
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
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text, flex: 1 },
  chip: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, letterSpacing: 0.5 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  btnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: '#ff3b5c', alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
