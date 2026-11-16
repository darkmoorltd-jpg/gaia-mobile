import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function SellerDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verification, setVerification] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [organicSeller, setOrganicSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [
      { data: v },
      { data: s },
      { data: i },
      { data: os },
      { data: p },
      { data: o },
    ] = await Promise.all([
      supabase.from('seller_verifications').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('seller_subscriptions').select('*, seller_tiers(name, commission_pct, max_products)').eq('user_id', user.id).eq('status', 'active').gt('period_end', new Date().toISOString()).maybeSingle(),
      supabase.from('seller_inspections').select('*').eq('user_id', user.id).eq('status', 'approved').order('approved_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('organic_sellers').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('organic_products').select('*').order('created_at', { ascending: false }),
      supabase.from('organic_orders').select('*').order('created_at', { ascending: false }),
    ]);
    setVerification(v);
    setSubscription(s);
    setInspection(i);
    setOrganicSeller(os);
    if (os) {
      setProducts((p || []).filter((x: any) => x.seller_id === os.id));
      setOrders((o || []).filter((x: any) => x.seller_id === os.id));
    } else {
      setProducts([]);
      setOrders([]);
    }
    setBusy(false);
  }, [user]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  // ---- Not verified yet ----
  if (!verification || verification.status === 'draft') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Start Selling</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🪪</Text>
            <Text style={styles.emptyTitle}>Verify your identity</Text>
            <Text style={styles.emptySub}>NIN + CAC + bank + farm GPS. Takes 5 minutes. Admin reviews in 1-2 days.</Text>
            <Pressable onPress={() => router.push('/seller-verify' as any)} style={styles.cta}>
              <Text style={styles.ctaTxt}>START VERIFICATION</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- Verification under review ----
  if (verification.status === 'submitted') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Under Review</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyTitle}>Verification submitted</Text>
            <Text style={styles.emptySub}>Admin is reviewing your documents. Usually 1-2 business days.</Text>
            <Text style={styles.emptyMeta}>Submitted {new Date(verification.updated_at || verification.created_at).toLocaleDateString()}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- Verification rejected ----
  if (verification.status === 'rejected' || verification.status === 'needs_fix') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Verification Issue</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>❌</Text>
            <Text style={styles.emptyTitle}>Could not verify</Text>
            <Text style={styles.emptySub}>{verification.rejection_reason || 'Please contact support.'}</Text>
            <Pressable onPress={() => router.push('/seller-verify' as any)} style={styles.cta}>
              <Text style={styles.ctaTxt}>FIX AND RESUBMIT</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- Verified, no subscription ----
  if (!subscription) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Verified ✅</Text>
          <Text style={styles.sub}>Choose a plan to start selling.</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💼</Text>
            <Text style={styles.emptyTitle}>Ready to subscribe</Text>
            <Text style={styles.emptySub}>Basic · Premium · Organic. Pick the tier that fits your volume.</Text>
            <Pressable onPress={() => router.push('/seller-subscribe' as any)} style={styles.cta}>
              <Text style={styles.ctaTxt}>CHOOSE A PLAN</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- Active seller ----
  const tier = subscription.seller_tiers;
  const daysToExpiry = Math.floor((new Date(subscription.period_end).getTime() - Date.now()) / 86400000);
  const activeOrders = orders.filter((o: any) => ['escrow','shipped','delivered'].includes(o.status));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>{verification.legal_name}</Text>
        <View style={[styles.badge, { marginTop: 8, alignSelf: 'flex-start' }]}>
          <Text style={styles.badgeTxt}>
            {tier?.name || subscription.tier_id} tier · {tier?.commission_pct || 5}% commission
          </Text>
        </View>

        {daysToExpiry <= 14 ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTxt}>⚠ Subscription expires in {daysToExpiry} days</Text>
            <Pressable onPress={() => router.push('/seller-subscribe' as any)} style={styles.warnBtn}>
              <Text style={styles.warnBtnTxt}>RENEW</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{products.length}{tier?.max_products >= 0 ? `/${tier.max_products}` : ''}</Text>
            <Text style={styles.statLbl}>PRODUCTS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{activeOrders.length}</Text>
            <Text style={styles.statLbl}>ACTIVE ORDERS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{daysToExpiry}d</Text>
            <Text style={styles.statLbl}>EXPIRES</Text>
          </View>
        </View>

        {!organicSeller ? (
          <Pressable onPress={() => router.push('/organic-seller-register' as any)} style={styles.setupCard}>
            <Text style={styles.setupIcon}>🌿</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.setupTitle}>Set up seller profile</Text>
              <Text style={styles.setupSub}>One more step to start listing products.</Text>
            </View>
            <Text style={styles.setupChevron}>›</Text>
          </Pressable>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push('/organic-seller-dashboard' as any)} style={styles.actionBtn}>
            <Text style={styles.actionBtnTxt}>📦 PRODUCTS</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/organic-orders' as any)} style={styles.actionBtn}>
            <Text style={styles.actionBtnTxt}>📋 ORDERS</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/seller-subscribe' as any)} style={styles.actionBtn}>
            <Text style={styles.actionBtnTxt}>⬆ UPGRADE</Text>
          </Pressable>
        </View>

        {!inspection ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Want Premium or Organic?</Text>
            <Text style={styles.infoSub}>Contact support to schedule a farm inspection.</Text>
          </View>
        ) : (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>✅ Farm inspected</Text>
            <Text style={styles.successSub}>Last inspection: {new Date(inspection.inspection_date).toLocaleDateString()}</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>RECENT ORDERS</Text>
        {orders.slice(0, 5).map((o: any) => (
          <View key={o.id} style={styles.orderCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.orderTitle}>₦{Number(o.total_paid).toLocaleString()}</Text>
              <Text style={styles.orderStatus}>{o.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.orderMeta}>{new Date(o.created_at).toLocaleString()}</Text>
          </View>
        ))}
        {orders.length === 0 ? <Text style={styles.emptyText}>No orders yet.</Text> : null}

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
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 16 },
  emptyCard: { backgroundColor: p.surface, padding: 32, borderRadius: 20, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginTop: 20 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 8 },
  emptySub: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyMeta: { fontSize: 11, color: p.textDim, marginTop: 8 },
  emptyText: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  cta: { backgroundColor: p.neon, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  badge: { backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.neon },
  badgeTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  warnBox: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,179,0,0.12)', borderWidth: 1, borderColor: '#ffb300', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warnTxt: { fontSize: 12, fontWeight: '800', color: '#ffb300', flex: 1 },
  warnBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ffb300', borderRadius: 8 },
  warnBtnTxt: { fontSize: 11, fontWeight: '900', color: '#000' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 1 },
  setupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 12, borderWidth: 1, borderColor: p.neon, marginBottom: 16 },
  setupIcon: { fontSize: 32 },
  setupTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  setupSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  setupChevron: { fontSize: 24, color: p.neon },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: { flex: 1, padding: 14, backgroundColor: p.surface, borderRadius: 10, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  actionBtnTxt: { fontSize: 10, fontWeight: '900', color: p.text, letterSpacing: 0.5 },
  infoBox: { padding: 14, backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6', marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: '900', color: '#3b82f6' },
  infoSub: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  successBox: { padding: 14, backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 12, borderWidth: 1, borderColor: p.neon, marginBottom: 16 },
  successTitle: { fontSize: 13, fontWeight: '900', color: p.neon },
  successSub: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 12 },
  orderCard: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  orderTitle: { fontSize: 15, fontWeight: '900', color: p.text },
  orderStatus: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  orderMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
});
