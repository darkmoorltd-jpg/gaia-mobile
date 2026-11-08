import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, TextInput, Modal, Image, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { categoryLabel } from '../src/data/input_categories';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmt = (s?: string) => s ? new Date(s).toLocaleString() : '—';

export default function AdminInputProviders() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [detail, setDetail] = useState<any | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('admin_list_input_providers', { p_status: 'all' });
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
    const { error } = await supabase.rpc('admin_reject_input_provider', {
      p_user_id: rejectModal.user_id, p_reason: rejectReason.trim()
    });
    if (error) Alert.alert('Failed', error.message);
    else { setRejectModal(null); setRejectReason(''); load(); }
  };

  const openDetail = async (provider: any) => {
    setDetail({ provider_row: provider, data: null });
    setDetailBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_input_provider_detail', { p_user_id: provider.user_id });
      if (error) { Alert.alert('Failed', error.message); setDetail(null); return; }
      setDetail({ provider_row: provider, data });
    } catch (e: any) { Alert.alert('Failed', e.message); setDetail(null); }
    finally { setDetailBusy(false); }
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
                <Text style={styles.meta}><Text style={styles.k}>Tier:</Text> {r.tier_id || '—'} · Paid: {r.onboarding_fee_paid ? 'YES' : 'NO'}</Text>
                <Text style={styles.meta}><Text style={styles.k}>Categories:</Text> {(r.categories || []).map(categoryLabel).join(', ')}</Text>

                {r.store_images && r.store_images.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    {r.store_images.map((img: string, i: number) => (
                      <Image key={i} source={{ uri: img }} style={{ width: 100, height: 70, borderRadius: 8, marginRight: 8 }} />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={{ color: '#ffb300', fontSize: 11, marginTop: 8 }}>⚠️ No images</Text>
                )}
                <Text style={[styles.meta, { color: '#b388ff', marginTop: 8 }]}>Tap card for full detail →</Text>
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
            <Text style={styles.label}>REASON (shown to provider)</Text>
            <TextInput value={rejectReason} onChangeText={setRejectReason} multiline
              style={[styles.input, { minHeight: 80 }]}
              placeholderTextColor={palette.textDim}
              placeholder="e.g. CAC number invalid" />
            <Pressable onPress={doReject} style={styles.ctaRed}><Text style={styles.ctaText}>REJECT APPLICATION</Text></Pressable>
            <Pressable onPress={() => setRejectModal(null)} style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }]}><Text style={[styles.ctaText, { color: palette.text }]}>CANCEL</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* GOD MODE DETAIL */}
      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, backgroundColor: palette.obsidian }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 60 }}>
            <Pressable onPress={() => setDetail(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>{detail?.provider_row?.business_name}</Text>
            <Text style={styles.sub}>{detail?.provider_row?.account_email}</Text>

            {detailBusy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

            {detail?.data ? <DetailView detail={detail.data} styles={styles} palette={palette} onRefresh={() => openDetail(detail.provider_row)} /> : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function DetailView({ detail, styles, palette, onRefresh }: any) {
  const p = detail.provider || {};
  const w = detail.wallet || {};
  const t = detail.totals || {};
  const products = detail.products || [];
  const sellOrders = detail.sell_orders || [];
  const buyOrders = detail.buy_orders || [];

  const tierPrice = { starter: 10000, growth: 30000, enterprise: 75000 }[p.tier_id] || 0;

  return (
    <>
      {/* STORE IMAGES */}
      {p.store_images && p.store_images.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>STORE PHOTOS ({p.store_images.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {p.store_images.map((img: string, i: number) => (
              <Pressable key={i} onPress={() => Linking.openURL(img)}>
                <Image source={{ uri: img }} style={{ width: 160, height: 120, borderRadius: 10, marginRight: 10 }} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* LOCATION */}
      {p.gps_lat && p.gps_lon ? (
        <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.gps_lat},${p.gps_lon}`)} style={styles.mapBtn}>
          <Text style={styles.mapBtnText}>📍 Open GPS Location on Map</Text>
        </Pressable>
      ) : null}

      {/* SUBSCRIPTION / REGISTRATION */}
      <Text style={styles.sectionLabel}>💰 SUBSCRIPTION / REGISTRATION FEE</Text>
      <View style={styles.finCard}>
        <View style={styles.finRow}>
          <Text style={styles.k}>Tier</Text>
          <Text style={styles.finVal}>{(p.tier_id || '—').toUpperCase()}</Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.k}>Annual Fee</Text>
          <Text style={styles.finVal}>{money(tierPrice)}</Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.k}>Payment Status</Text>
          <Text style={[styles.finVal, { color: p.onboarding_fee_paid ? '#00ff88' : '#ff3b5c' }]}>
            {p.onboarding_fee_paid ? '✅ PAID' : '❌ UNPAID'}
          </Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.k}>Reference</Text>
          <Text style={styles.finVal}>{p.payment_ref || '—'}</Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.k}>Expires</Text>
          <Text style={styles.finVal}>{fmt(p.subscription_expires_at)}</Text>
        </View>
      </View>

      {/* WALLET */}
      <Text style={styles.sectionLabel}>💼 SELLER WALLET</Text>
      <View style={styles.finCard}>
        <View style={styles.finRow}>
          <Text style={styles.k}>Balance</Text>
          <Text style={[styles.finVal, { color: '#00ff88' }]}>{money(w.balance)}</Text>
        </View>
        {w.virtual_account ? (
          <View style={styles.finRow}>
            <Text style={styles.k}>Virtual Account</Text>
            <Text style={styles.finVal}>{w.virtual_account}</Text>
          </View>
        ) : null}
      </View>

      {/* FINANCIAL SUMMARY */}
      <Text style={styles.sectionLabel}>📊 FINANCIAL SUMMARY</Text>
      <View style={styles.finCard}>
        <View style={styles.finRow}>
          <Text style={styles.k}>Total Earned (released)</Text>
          <Text style={[styles.finVal, { color: '#00ff88' }]}>{money(t.total_earned)}</Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.k}>In Escrow (held)</Text>
          <Text style={[styles.finVal, { color: '#ffb300' }]}>{money(t.in_escrow)}</Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.k}>Pending Payment</Text>
          <Text style={[styles.finVal, { color: '#4fc3f7' }]}>{money(t.pending_payment)}</Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.k}>Total Spent (as buyer)</Text>
          <Text style={styles.finVal}>{money(t.total_spent)}</Text>
        </View>
        <View style={[styles.finRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.k}>Orders</Text>
          <Text style={styles.finVal}>{t.order_count_sell || 0} sold · {t.order_count_buy || 0} bought</Text>
        </View>
      </View>

      {/* BANK */}
      <Text style={styles.sectionLabel}>🏦 BANK DETAILS</Text>
      <View style={styles.finCard}>
        <View style={styles.finRow}><Text style={styles.k}>Bank</Text><Text style={styles.finVal}>{p.bank_name || '—'}</Text></View>
        <View style={styles.finRow}><Text style={styles.k}>Account Number</Text><Text style={styles.finVal}>{p.bank_account_number || '—'}</Text></View>
        <View style={styles.finRow}><Text style={styles.k}>Account Name</Text><Text style={styles.finVal}>{p.bank_account_name || '—'}</Text></View>
        <View style={[styles.finRow, { borderBottomWidth: 0 }]}><Text style={styles.k}>CAC</Text><Text style={styles.finVal}>{p.business_reg_number || '—'}</Text></View>
      </View>

      {/* PRODUCTS */}
      <Text style={styles.sectionLabel}>📦 PRODUCTS ({products.length})</Text>
      {products.length === 0 ? (
        <Text style={{ color: palette.textMuted, fontStyle: 'italic' }}>No products listed.</Text>
      ) : (
        products.map((prod: any, i: number) => (
          <View key={i} style={styles.subCard}>
            <Text style={{ color: palette.text, fontWeight: '800' }}>{prod.name}</Text>
            <Text style={{ color: '#b388ff', fontSize: 13 }}>{money(prod.price_ngn)} / {prod.unit}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 4 }}>
              Stock: {prod.quantity_available} · {prod.category} · {prod.active ? 'LIVE' : 'HIDDEN'}
            </Text>
          </View>
        ))
      )}

      {/* INCOMING ORDERS (SELL) */}
      <Text style={styles.sectionLabel}>🛒 INCOMING ORDERS ({sellOrders.length})</Text>
      {sellOrders.length === 0 ? (
        <Text style={{ color: palette.textMuted, fontStyle: 'italic' }}>No orders received yet.</Text>
      ) : (
        sellOrders.map((o: any, i: number) => {
          const pc = o.payment_status === 'released' ? '#00ff88'
            : o.payment_status === 'held_in_escrow' ? '#ffb300'
            : '#4fc3f7';
          return (
            <View key={i} style={styles.subCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: palette.text, fontWeight: '800' }}>{o.product_name}</Text>
                <Text style={{ color: pc, fontSize: 10, fontWeight: '900' }}>{String(o.payment_status || '').toUpperCase()}</Text>
              </View>
              <Text style={{ color: '#b388ff', fontSize: 13, marginTop: 2 }}>
                {money(o.total_ngn)} · qty {o.quantity}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 2 }}>
                Buyer: {o.buyer_email || '—'}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 10 }}>
                Ref: {(o.payment_reference || '').slice(0, 20)} · {fmt(o.created_at)}
              </Text>
              
              {o.payment_status === 'held_in_escrow' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable 
                    onPress={() => {
                      Alert.alert('Refund Buyer?', 'This will return the money to the buyer and cancel the order.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Refund', style: 'destructive', onPress: async () => {
                          const { error } = await supabase.rpc('admin_refund_input_order', { p_order_id: o.id });
                          if (error) Alert.alert('Failed', error.message);
                          else { Alert.alert('Refunded', 'Buyer wallet has been credited.'); onRefresh(); }
                        }}
                      ]);
                    }} 
                    style={{ flex: 1, paddingVertical: 8, backgroundColor: 'rgba(255,59,92,0.1)', borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#ff3b5c' }}
                  >
                    <Text style={{ color: '#ff3b5c', fontSize: 10, fontWeight: '900' }}>REFUND BUYER</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      Alert.alert('Force Pay Seller?', 'This bypasses buyer confirmation and pays the seller immediately.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Pay Seller', onPress: async () => {
                          const { error } = await supabase.rpc('admin_force_release_input_order', { p_order_id: o.id });
                          if (error) Alert.alert('Failed', error.message);
                          else { Alert.alert('Paid', 'Seller wallet has been credited.'); onRefresh(); }
                        }}
                      ]);
                    }} 
                    style={{ flex: 1, paddingVertical: 8, backgroundColor: 'rgba(0,255,136,0.1)', borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#00ff88' }}
                  >
                    <Text style={{ color: '#00ff88', fontSize: 10, fontWeight: '900' }}>FORCE PAY SELLER</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {/* OUTGOING ORDERS (BUY) */}
      <Text style={styles.sectionLabel}>💸 OUTGOING ORDERS ({buyOrders.length})</Text>
      {buyOrders.length === 0 ? (
        <Text style={{ color: palette.textMuted, fontStyle: 'italic' }}>This provider hasn't purchased anything.</Text>
      ) : (
        buyOrders.map((o: any, i: number) => (
          <View key={i} style={styles.subCard}>
            <Text style={{ color: palette.text, fontWeight: '800' }}>{o.product_name}</Text>
            <Text style={{ color: '#4fc3f7', fontSize: 13, marginTop: 2 }}>
              {money(o.total_ngn)} · qty {o.quantity}
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 11 }}>
              Seller: {o.seller_email || '—'}
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 10 }}>
              Status: {o.status} · {fmt(o.created_at)}
            </Text>
          </View>
        ))
      )}
    </>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#b388ff', marginTop: 20, marginBottom: 8 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  subCard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  finCard: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  finVal: { fontSize: 13, fontWeight: '800', color: p.text },
  name: { fontSize: 16, fontWeight: '900', color: p.text, flex: 1 },
  chip: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, letterSpacing: 0.5 },
  meta: { fontSize: 12, color: p.text, marginTop: 4 },
  k: { color: p.textMuted, fontWeight: '700' },
  mapBtn: { marginTop: 10, marginBottom: 12, paddingVertical: 10, backgroundColor: 'rgba(179,136,255,0.15)', borderRadius: 8, alignItems: 'center' },
  mapBtnText: { color: '#b388ff', fontSize: 12, fontWeight: '800' },
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
