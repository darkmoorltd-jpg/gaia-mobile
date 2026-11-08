import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, TextInput, Modal, Image, Linking } from 'react-native';
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
  
  // Modals
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailModal, setDetailModal] = useState<any>(null); // view products/orders
  const [detailProducts, setDetailProducts] = useState<any[]>([]);
  const [detailOrders, setDetailOrders] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_list_input_providers', { p_status: 'all' });
    setRows(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = (id: string) => {
    Alert.alert('Approve provider?', 'This will activate their store.', [
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

  const openDetail = async (provider: any) => {
    setDetailModal(provider);
    setLoadingDetail(true);
    // Fetch their products and orders
    const [prodRes, orderRes] = await Promise.all([
      supabase.from('input_products').select('*').eq('provider_id', provider.user_id),
      supabase.from('input_orders').select('*').eq('provider_id', provider.user_id).order('created_at', { ascending: false }).limit(20)
    ]);
    setDetailProducts(prodRes.data || []);
    setDetailOrders(orderRes.data || []);
    setLoadingDetail(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Input Providers</Text>
        <Text style={styles.sub}>{rows.length} total · God Mode</Text>

        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}

        {rows.map((r) => {
          const c = r.status === 'active' ? '#00ff88' : r.status === 'rejected' ? '#ff3b5c' : '#ffb300';
          return (
            <View key={r.user_id} style={styles.card}>
              <Pressable onPress={() => openDetail(r)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.name}>{r.business_name}</Text>
                  <Text style={[styles.chip, { color: c, borderColor: c }]}>{String(r.status || '').toUpperCase()}</Text>
                </View>
                
                <Text style={styles.meta}><Text style={styles.k}>Email:</Text> {r.account_email}</Text>
                <Text style={styles.meta}><Text style={styles.k}>Location:</Text> {r.city}, {r.lga}, {r.state}</Text>
                <Text style={styles.meta}><Text style={styles.k}>Phone:</Text> {r.phone} · WA: {r.whatsapp}</Text>
                <Text style={styles.meta}><Text style={styles.k}>Categories:</Text> {(r.categories || []).map(categoryLabel).join(', ')}</Text>
                {r.business_reg_number ? <Text style={styles.meta}><Text style={styles.k}>CAC:</Text> {r.business_reg_number}</Text> : null}
                <Text style={styles.meta}><Text style={styles.k}>Bank:</Text> {r.bank_name} · {r.bank_account_number}</Text>
                
                {r.gps_lat && r.gps_lon ? (
                  <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${r.gps_lat},${r.gps_lon}`)} style={styles.mapBtn}>
                    <Text style={styles.mapBtnText}>📍 Open GPS Location</Text>
                  </Pressable>
                ) : null}

                {r.store_images && r.store_images.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 12 }}>
                    {r.store_images.map((img: string, i: number) => (
                      <Pressable key={i} onPress={() => Linking.openURL(img)}>
                        <Image source={{ uri: img }} style={{ width: 120, height: 80, borderRadius: 8, marginRight: 8 }} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={{ color: '#ffb300', fontSize: 11, marginTop: 8 }}>⚠️ No images uploaded</Text>
                )}
              </Pressable>

              {r.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
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

      {/* REJECT MODAL */}
      <Modal visible={!!rejectModal} animationType="slide" transparent onRequestClose={() => setRejectModal(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>Reject</Text>
            <Text style={styles.meta}>{rejectModal?.business_name}</Text>
            <Text style={styles.label}>REASON</Text>
            <TextInput value={rejectReason} onChangeText={setRejectReason} multiline style={[styles.input, { minHeight: 80 }]} placeholderTextColor={palette.textDim} placeholder="e.g. CAC number invalid" />
            <Pressable onPress={doReject} style={styles.ctaRed}><Text style={styles.ctaText}>REJECT APPLICATION</Text></Pressable>
            <Pressable onPress={() => setRejectModal(null)} style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }]}><Text style={[styles.ctaText, { color: palette.text }]}>CANCEL</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* DETAIL MODAL (God Mode) */}
      <Modal visible={!!detailModal} animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={{ flex: 1, backgroundColor: palette.obsidian }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
            <Pressable onPress={() => setDetailModal(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>{detailModal?.business_name}</Text>
            
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PRODUCTS ({detailProducts.length})</Text>
            {loadingDetail ? <ActivityIndicator color={palette.neon} /> : null}
            {!loadingDetail && detailProducts.length === 0 ? <Text style={{ color: palette.textMuted }}>No products listed.</Text> : null}
            {detailProducts.map((p, i) => (
              <View key={i} style={styles.subCard}>
                <Text style={{ color: palette.text, fontWeight: '800' }}>{p.name}</Text>
                <Text style={{ color: palette.neon }}>₦{Number(p.price_ngn).toLocaleString()} / {p.unit}</Text>
                <Text style={{ color: palette.textMuted, fontSize: 11 }}>Stock: {p.quantity_available} · {p.status}</Text>
              </View>
            ))}

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RECENT ORDERS ({detailOrders.length})</Text>
            {!loadingDetail && detailOrders.length === 0 ? <Text style={{ color: palette.textMuted }}>No orders yet.</Text> : null}
            {detailOrders.map((o, i) => (
              <View key={i} style={styles.subCard}>
                <Text style={{ color: palette.text, fontWeight: '800' }}>{o.product_name} × {o.quantity}</Text>
                <Text style={{ color: '#b388ff' }}>₦{Number(o.total_ngn).toLocaleString()}</Text>
                <Text style={{ color: o.payment_status === 'released' ? '#00ff88' : '#ffb300', fontSize: 11 }}>
                  Payment: {o.payment_status} · Status: {o.status}
                </Text>
              </View>
            ))}
            <View style={{ height: 80 }} />
          </ScrollView>
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
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.neon, marginBottom: 8 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  subCard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  name: { fontSize: 16, fontWeight: '900', color: p.text, flex: 1 },
  chip: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, letterSpacing: 0.5 },
  meta: { fontSize: 12, color: p.text, marginTop: 4 },
  k: { color: p.textMuted, fontWeight: '700' },
  mapBtn: { marginTop: 10, paddingVertical: 8, backgroundColor: 'rgba(179,136,255,0.15)', borderRadius: 8, alignItems: 'center' },
  mapBtnText: { color: '#b388ff', fontSize: 11, fontWeight: '800' },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  btnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.surface, alignItems: 'center', marginTop: 16 },
  ctaRed: { padding: 16, borderRadius: 12, backgroundColor: '#ff3b5c', alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
