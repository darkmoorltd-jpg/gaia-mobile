import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  fetchBuyerOrders, fetchSellerOrders, releaseEscrow,
  getSellerProfile, naira, statusColor, API_BASE,
} from '../src/utils/marketplace';
import { displayName } from '../src/utils/friends';
import { supabase } from '../src/api/supabase';

export default function Orders() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer');
  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [releasing, setReleasing] = useState<string | null>(null);

  const [shipModal, setShipModal] = useState<any>(null);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [shipBusy, setShipBusy] = useState(false);

  const [disputeModal, setDisputeModal] = useState<any>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeFiles, setDisputeFiles] = useState<string[]>([]);
  const [disputeBusy, setDisputeBusy] = useState(false);

  const [respondModal, setRespondModal] = useState<any>(null);
  const [respondText, setRespondText] = useState('');
  const [respondProposal, setRespondProposal] = useState<'full_refund'|'partial_refund'|'no_refund'>('no_refund');
  const [respondFiles, setRespondFiles] = useState<string[]>([]);
  const [respondBusy, setRespondBusy] = useState(false);

  const [reviewModal, setReviewModal] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [b, s] = await Promise.all([fetchBuyerOrders(user.id), fetchSellerOrders(user.id)]);
    setBuyerOrders(b);
    setSellerOrders(s);

    const orderIds = [...b.map((o: any) => o.id), ...s.map((o: any) => o.id)];
    if (orderIds.length > 0) {
      const { data: dsp } = await supabase.from('marketplace_disputes')
        .select('*').in('order_id', orderIds)
        .in('status', ['open','seller_responded','auto_escalated']);
      setDisputes(dsp || []);
    } else {
      setDisputes([]);
    }
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const disputeForOrder = (orderId: any) => disputes.find(d => d.order_id === orderId);

  const chatWithSeller = async (sellerId: string) => {
    const prof = await getSellerProfile(sellerId);
    router.push({ pathname: '/chat-room', params: { peerId: sellerId, peerName: displayName(prof) || 'Seller', peerEmail: prof.email || '' } } as any);
  };
  const chatWithBuyer = (order: any) => {
    router.push({ pathname: '/chat-room', params: { peerId: order.buyer_id, peerName: order.buyer_name || 'Buyer', peerEmail: '' } } as any);
  };

  const openReceipt = (order: any) => {
    router.push({ pathname: '/escrow-receipt', params: { order_id: String(order.id) } } as any);
  };

  const confirmDelivery = (order: any) => {
    Alert.alert('Confirm delivery?', 'This releases ' + naira(order.total) + ' from escrow to the seller. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setReleasing(String(order.id));
        try {
          const r = await releaseEscrow(order.id);
          setReleasing(null);
          Alert.alert('Delivered', 'Seller credited ' + naira(r.seller_credited) + '. Rate this seller?', [
            { text: 'Later', style: 'cancel', onPress: load },
            { text: 'Rate now', onPress: () => { setReviewModal(order); setRating(5); setComment(''); load(); } },
          ]);
        } catch (e: any) {
          setReleasing(null);
          Alert.alert('Failed', e.message || 'Try again');
        }
      }},
    ]);
  };

  const submitShip = async () => {
    if (!shipModal) return;
    setShipBusy(true);
    try {
      const { error } = await supabase.rpc('marketplace_ship_order', {
        p_order_id: String(shipModal.id),
        p_carrier: carrier.trim() || null,
        p_tracking_number: tracking.trim() || null,
        p_estimated_delivery: null,
      });
      if (error) throw error;
      setShipModal(null); setCarrier(''); setTracking('');
      await load();
      Alert.alert('Shipped', 'Buyer notified.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setShipBusy(false);
    }
  };

  const markDelivered = (order: any) => {
    Alert.alert('Mark as delivered?', 'Buyer will be notified to confirm.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        try {
          const { error } = await supabase.rpc('marketplace_order_delivered', {
            p_order_id: String(order.id), p_proof_url: null,
          });
          if (error) throw error;
          await load();
          Alert.alert('Delivered', 'Buyer notified.');
        } catch (e: any) { Alert.alert('Failed', e.message); }
      }},
    ]);
  };

  const pickDisputeFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
    if (!r.canceled) setDisputeFiles([...disputeFiles, r.assets[0].uri]);
  };
  const pickRespondFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
    if (!r.canceled) setRespondFiles([...respondFiles, r.assets[0].uri]);
  };

  const uploadEvidence = async (uri: string, disputeOrderId: string): Promise<string> => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const ext = (uri.split('.').pop() || 'bin').toLowerCase();
    const path = `${user!.id}/${disputeOrderId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('dispute-evidence').upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    return path;
  };

  const submitDispute = async () => {
    if (!disputeModal || !disputeReason.trim()) { Alert.alert('Reason required'); return; }
    setDisputeBusy(true);
    try {
      const paths: string[] = [];
      for (const f of disputeFiles) paths.push(await uploadEvidence(f, String(disputeModal.id)));

      const { data, error } = await supabase.rpc('file_marketplace_dispute', {
        p_order_id: String(disputeModal.id),
        p_kind: 'marketplace',
        p_reason: disputeReason.trim(),
        p_description: disputeDesc.trim() || '',
        p_claimed_amount: Number(disputeModal.total) || null,
        p_evidence_paths: paths,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Dispute failed');

      setDisputeModal(null); setDisputeReason(''); setDisputeDesc(''); setDisputeFiles([]);
      await load();
      Alert.alert('Dispute filed', `Ref: ${data.dispute_code}\n\nSeller has 48h to respond. Admin will review.`);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setDisputeBusy(false);
    }
  };

  const submitRespond = async () => {
    if (!respondModal || !respondText.trim()) { Alert.alert('Response required'); return; }
    setRespondBusy(true);
    try {
      const paths: string[] = [];
      for (const f of respondFiles) paths.push(await uploadEvidence(f, String(respondModal.order_id)));

      const { error } = await supabase.rpc('respond_to_marketplace_dispute', {
        p_dispute_id: respondModal.id,
        p_response: respondText.trim(),
        p_proposal: respondProposal,
        p_evidence_paths: paths,
      });
      if (error) throw error;

      setRespondModal(null); setRespondText(''); setRespondFiles([]);
      await load();
      Alert.alert('Responded', 'Admin will review.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setRespondBusy(false);
    }
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    setReviewBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const t = session?.session?.access_token || '';
      const r = await fetch(API_BASE + '/marketplace/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ order_id: String(reviewModal.id), rating, comment: comment.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.error || 'Failed');
      setReviewModal(null); setComment(''); setRating(5);
      Alert.alert('Thanks!', 'Your review is live.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setReviewBusy(false);
    }
  };

  const list = tab === 'buyer' ? buyerOrders : sellerOrders;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Orders</Text>

        <View style={styles.tabs}>
          <Pressable onPress={() => setTab('buyer')} style={[styles.tab, tab === 'buyer' && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === 'buyer' && styles.tabTxtActive]}>My Orders ({buyerOrders.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('seller')} style={[styles.tab, tab === 'seller' && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === 'seller' && styles.tabTxtActive]}>Incoming ({sellerOrders.length})</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginVertical: 20 }} /> : null}
        {!busy && list.length === 0 ? <Text style={styles.empty}>No orders yet.</Text> : null}

        {list.map((o) => {
          const sColor = statusColor(o.status, palette);
          const isBuyer = tab === 'buyer';
          const dispute = disputeForOrder(o.id);
          const inEscrow = ['paid', 'shipped', 'delivered'].includes(o.status);
          const canRelease = isBuyer && o.status === 'delivered' && !dispute;
          const canShip = !isBuyer && o.status === 'paid' && !dispute;
          const canMarkDelivered = !isBuyer && o.status === 'shipped' && !dispute;
          const canDispute = isBuyer && ['paid','shipped','delivered'].includes(o.status) && !dispute;
          const canRespond = !isBuyer && dispute && dispute.status === 'open';
          const canReview = isBuyer && o.status === 'confirmed' && !o.reviewed_at;

          return (
            <View key={o.id} style={[styles.card, dispute && { borderColor: '#ff3b5c' }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => router.push({ pathname: '/escrow-chat', params: { order_id: String(o.id) } } as any)}>
                    <Text style={styles.ref}>#{o.order_ref} 💬</Text>
                  </Pressable>
                  <Pressable onPress={() => openReceipt(o)}><Text style={styles.ref}>🧾</Text></Pressable>
                </View>
                <View style={[styles.statusPill, { borderColor: sColor + '88' }]}>
                  <Text style={[styles.statusTxt, { color: sColor }]}>{(o.status || 'pending').toUpperCase()}</Text>
                </View>
              </View>

              {dispute ? (
                <View style={styles.disputeBanner}>
                  <Text style={styles.disputeBannerTxt}>
                    ⚠ Dispute {dispute.dispute_code} · {String(dispute.status).replace('_',' ').toUpperCase()}
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardBody}>
                {o.listing_image ? <Image source={{ uri: o.listing_image }} style={styles.thumb} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{o.listing_title}</Text>
                  <Text style={styles.itemSub}>{o.quantity} × {naira(o.subtotal || 0)}</Text>
                  <Text style={styles.total}>{naira(o.total || 0)}</Text>
                </View>
              </View>

              {o.tracking_number ? (
                <View style={styles.trackBox}>
                  <Text style={styles.trackLbl}>TRACKING</Text>
                  <Text style={styles.trackVal}>{o.tracking_number}</Text>
                  <Text style={styles.trackMeta}>{o.carrier || '—'}{o.estimated_delivery ? ' · ETA ' + new Date(o.estimated_delivery).toLocaleDateString() : ''}</Text>
                </View>
              ) : null}

              {inEscrow && !dispute ? (
                <View style={styles.escrowBox}>
                  <Text style={styles.escrowTxt}>
                    {isBuyer
                      ? naira(o.total) + ' in escrow · released when you confirm delivery'
                      : naira(o.seller_net || 0) + ' will be credited to your wallet on delivery'}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.meta}>{o.delivery_method === 'home' ? 'Home delivery' : 'Pickup'} · {o.delivery_address}</Text>
              {o.buyer_name ? <Text style={styles.meta}>Buyer: {o.buyer_name}</Text> : null}

              <View style={styles.actions}>
                {isBuyer ? (
                  <>
                    <Pressable onPress={() => chatWithSeller(o.seller_id)} style={styles.chatBtn}>
                      <Text style={styles.chatBtnTxt}>CHAT SELLER</Text>
                    </Pressable>
                    {canRelease ? (
                      <Pressable onPress={() => confirmDelivery(o)} disabled={releasing === String(o.id)} style={styles.confirmBtn}>
                        {releasing === String(o.id) ? <ActivityIndicator color={palette.obsidian} size="small" /> : <Text style={styles.confirmBtnTxt}>CONFIRM DELIVERY</Text>}
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Pressable onPress={() => chatWithBuyer(o)} style={styles.chatBtn}>
                      <Text style={styles.chatBtnTxt}>CHAT BUYER</Text>
                    </Pressable>
                    {canShip ? (
                      <Pressable onPress={() => { setShipModal(o); setCarrier(''); setTracking(''); }} style={styles.confirmBtn}>
                        <Text style={styles.confirmBtnTxt}>MARK SHIPPED</Text>
                      </Pressable>
                    ) : null}
                    {canMarkDelivered ? (
                      <Pressable onPress={() => markDelivered(o)} style={[styles.confirmBtn, { backgroundColor: '#3b82f6' }]}>
                        <Text style={styles.confirmBtnTxt}>MARK DELIVERED</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>

              {(canDispute || canRespond || canReview) ? (
                <View style={styles.secondRow}>
                  {canDispute ? (
                    <Pressable onPress={() => { setDisputeModal(o); setDisputeReason(''); setDisputeDesc(''); setDisputeFiles([]); }} style={styles.warnBtn}>
                      <Text style={styles.warnBtnTxt}>RAISE DISPUTE</Text>
                    </Pressable>
                  ) : null}
                  {canRespond ? (
                    <Pressable onPress={() => { setRespondModal(dispute); setRespondText(''); setRespondProposal('no_refund'); setRespondFiles([]); }} style={[styles.warnBtn, { borderColor: '#ff3b5c' }]}>
                      <Text style={[styles.warnBtnTxt, { color: '#ff3b5c' }]}>RESPOND TO DISPUTE</Text>
                    </Pressable>
                  ) : null}
                  {canReview ? (
                    <Pressable onPress={() => { setReviewModal(o); setRating(5); setComment(''); }} style={styles.starBtn}>
                      <Text style={styles.starBtnTxt}>RATE SELLER</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* SHIP MODAL */}
      <Modal visible={!!shipModal} transparent animationType="slide" onRequestClose={() => setShipModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Mark as shipped</Text>
            <Text style={styles.modalSub}>Buyer gets a notification with tracking details.</Text>
            <Text style={styles.label}>CARRIER</Text>
            <TextInput value={carrier} onChangeText={setCarrier} placeholder="GIG, Kwik, Sendbox, Personal..." placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} />
            <Text style={styles.label}>TRACKING NUMBER</Text>
            <TextInput value={tracking} onChangeText={setTracking} placeholder="e.g. KWK-2026-12345" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} autoCapitalize="characters" />
            <Pressable onPress={submitShip} disabled={shipBusy} style={[styles.cta, shipBusy && { opacity: 0.5 }]}>
              {shipBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>CONFIRM SHIPPED</Text>}
            </Pressable>
            <Pressable onPress={() => setShipModal(null)} style={styles.cancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DISPUTE MODAL */}
      <Modal visible={!!disputeModal} transparent animationType="slide" onRequestClose={() => setDisputeModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Raise a dispute</Text>
            <Text style={styles.modalSub}>Seller has 48h to respond. Admin reviews.</Text>
            <Text style={styles.label}>REASON *</Text>
            <TextInput value={disputeReason} onChangeText={setDisputeReason} placeholder="Never shipped, wrong item, damaged..." placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} />
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput value={disputeDesc} onChangeText={setDisputeDesc} placeholder="Add details..." placeholderTextColor="rgba(255,255,255,0.3)" style={[styles.input, { height: 90, textAlignVertical: 'top' }]} multiline />

            <Text style={styles.label}>EVIDENCE ({disputeFiles.length})</Text>
            <Pressable onPress={pickDisputeFile} style={styles.uploadBtn}>
              <Text style={styles.uploadTxt}>+ ADD FILE (photo/PDF)</Text>
            </Pressable>

            <Pressable onPress={submitDispute} disabled={disputeBusy} style={[styles.cta, { backgroundColor: '#ff3b5c', marginTop: 20 }, disputeBusy && { opacity: 0.5 }]}>
              {disputeBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.ctaTxt, { color: '#fff' }]}>SUBMIT DISPUTE</Text>}
            </Pressable>
            <Pressable onPress={() => setDisputeModal(null)} style={styles.cancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* RESPOND MODAL */}
      <Modal visible={!!respondModal} transparent animationType="slide" onRequestClose={() => setRespondModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Respond to dispute</Text>
            <Text style={styles.modalSub}>Dispute: {respondModal?.dispute_code}</Text>
            <Text style={styles.modalSub}>Buyer claims: {respondModal?.reason}</Text>

            <Text style={styles.label}>YOUR RESPONSE *</Text>
            <TextInput value={respondText} onChangeText={setRespondText} placeholder="Your side of the story..." placeholderTextColor="rgba(255,255,255,0.3)" style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline />

            <Text style={styles.label}>PROPOSED RESOLUTION</Text>
            {(['no_refund','partial_refund','full_refund'] as const).map(p => (
              <Pressable key={p} onPress={() => setRespondProposal(p)} style={styles.radioRow}>
                <View style={[styles.radio, respondProposal === p && styles.radioOn]}>
                  {respondProposal === p ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={styles.radioTxt}>{p.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
              </Pressable>
            ))}

            <Text style={styles.label}>EVIDENCE ({respondFiles.length})</Text>
            <Pressable onPress={pickRespondFile} style={styles.uploadBtn}>
              <Text style={styles.uploadTxt}>+ ADD FILE (photo/PDF)</Text>
            </Pressable>

            <Pressable onPress={submitRespond} disabled={respondBusy} style={[styles.cta, { backgroundColor: '#3b82f6', marginTop: 20 }, respondBusy && { opacity: 0.5 }]}>
              {respondBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.ctaTxt, { color: '#fff' }]}>SUBMIT RESPONSE</Text>}
            </Pressable>
            <Pressable onPress={() => setRespondModal(null)} style={styles.cancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* REVIEW MODAL */}
      <Modal visible={!!reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Rate this seller</Text>
            <View style={styles.stars}>
              {[1,2,3,4,5].map(n => (
                <Pressable key={n} onPress={() => setRating(n)}>
                  <Text style={[styles.star, { color: n <= rating ? '#ffd700' : 'rgba(255,255,255,0.2)' }]}>★</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>COMMENT</Text>
            <TextInput value={comment} onChangeText={setComment} placeholder="Fast delivery, good quality..." placeholderTextColor="rgba(255,255,255,0.3)" style={[styles.input, { height: 90, textAlignVertical: 'top' }]} multiline />
            <Pressable onPress={submitReview} disabled={reviewBusy} style={[styles.cta, reviewBusy && { opacity: 0.5 }]}>
              {reviewBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>SUBMIT REVIEW</Text>}
            </Pressable>
            <Pressable onPress={() => setReviewModal(null)} style={styles.cancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  tabTxt: { fontSize: 12, fontWeight: '800', color: p.textMuted },
  tabTxtActive: { color: p.neon },
  empty: { fontSize: 14, color: p.textMuted, textAlign: 'center', paddingVertical: 40 },
  card: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ref: { fontSize: 11, color: p.textDim, fontFamily: 'monospace' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  disputeBanner: { marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(255,59,92,0.12)', borderWidth: 1, borderColor: '#ff3b5c' },
  disputeBannerTxt: { fontSize: 11, fontWeight: '900', color: '#ff3b5c' },
  cardBody: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  itemTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  itemSub: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  total: { fontSize: 16, fontWeight: '900', color: p.neon, marginTop: 4 },
  trackBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(79,195,247,0.06)', borderWidth: 1, borderColor: 'rgba(79,195,247,0.3)' },
  trackLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: '#4fc3f7' },
  trackVal: { fontSize: 15, fontWeight: '900', color: p.text, marginTop: 4, fontFamily: 'monospace' },
  trackMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  escrowBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.border },
  escrowTxt: { fontSize: 11, color: p.neon, lineHeight: 16 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chatBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  chatBtnTxt: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: p.neon, alignItems: 'center' },
  confirmBtnTxt: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 0.5 },
  secondRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  warnBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#ff3b5c', alignItems: 'center' },
  warnBtnTxt: { fontSize: 11, fontWeight: '900', color: '#ff3b5c', letterSpacing: 0.5 },
  starBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#ffd700', alignItems: 'center' },
  starBtnTxt: { fontSize: 11, fontWeight: '900', color: '#ffd700', letterSpacing: 0.5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.obsidian, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  modalSub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#fff', fontSize: 14 },
  cta: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  cancel: { marginTop: 12, padding: 12, alignItems: 'center' },
  cancelTxt: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
  star: { fontSize: 44, fontWeight: '900' },
  uploadBtn: { padding: 14, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: p.neon, alignItems: 'center', marginBottom: 8 },
  uploadTxt: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: p.neon },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon },
  radioTxt: { fontSize: 13, color: p.text },
});
