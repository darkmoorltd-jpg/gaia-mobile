// app/buy-scans.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';

type Plan = {
  key: string;
  name: string;
  scans: number;
  price: number;
  priceLabel: string;
  tag?: string;
};

const PLANS: Plan[] = [
  { key: 'starter',    name: 'Starter',    scans: 150,  price: 3000,  priceLabel: 'N3,000'  },
  { key: 'pro',        name: 'Pro',        scans: 300,  price: 5000,  priceLabel: 'N5,000',  tag: 'POPULAR' },
  { key: 'business',   name: 'Business',   scans: 1000, price: 10000, priceLabel: 'N10,000' },
  { key: 'enterprise', name: 'Enterprise', scans: 5000, price: 20000, priceLabel: 'N20,000' },
];

export default function BuyScans() {
  const router = useRouter();
  const { t } = useTranslation();
  const palette = useTheme((s: any) => s.palette);
  const styles = createStyles(palette);

  const user = useAuth((s: any) => s.user);
  const scansRemaining = useAuth((s: any) => s.scansRemaining);
  const plan = useAuth((s: any) => s.plan);
  const refreshScans = useAuth((s: any) => s.refreshScans);

  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) { setBusy(false); return; }
    try {
      const { data } = await supabase
        .from('payment_history')
        .select('amount, scans_added, plan, reference, paid_at')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false })
        .limit(20);
      setHistory(data || []);
    } catch (e) {
      console.warn('history load failed', e);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshScans(); } catch {}
    await loadHistory();
  }, [refreshScans, loadHistory]);

  const buyPlan = (p: Plan) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    const ref = 'GAIA_' + user.id.slice(0, 8) + '_' + Date.now().toString(36);
    const html = `
      <html><body>
      <script src="https://js.paystack.co/v1/inline.js"></script>
      <script>
        window.onload = function() {
          PaystackPop.setup({
            key: '${PAYSTACK_PUBLIC}',
            email: '${user.email}',
            amount: ${p.price * 100},
            currency: 'NGN',
            ref: '${ref}',
            label: 'GAIA ${p.name}',
            callback: function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({status: 'success', ref: response.reference, plan: '${p.key}'}));
            },
            onClose: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({status: 'closed'}));
            }
          }).openIframe();
        };
      </script>
      </body></html>
    `;
    // Simple: open Paystack via alert-free redirect
    // (Using Alert + manual copy is more reliable than WebView on some devices)
    Alert.alert(
      'Pay ' + p.priceLabel,
      'You will be redirected to Paystack to complete payment for ' + p.scans + ' scans.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay now',
          onPress: () => {
            // Navigate to Paystack hosted page directly
            const url = 'https://paystack.com/pay/gaia_' + p.key + '?email=' + encodeURIComponent(user.email || '');
            // Try in-app browser approach via Linking
            import('expo-linking').then((L) => {
              L.openURL(url).catch(() => {
                Alert.alert('Cannot open browser', 'Please visit: ' + url);
              });
            });
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Sign in required</Text>
          <Pressable onPress={() => router.push('/(auth)/login' as any)} style={styles.cta}>
            <Text style={styles.ctaText}>GO TO LOGIN</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>Buy Scans</Text>
        <Text style={styles.subtitle}>Top up your AI diagnostics balance</Text>

        <LinearGradient
          colors={[palette.neon, palette.neonDim || '#00b85c']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>BALANCE</Text>
          <Text style={styles.heroValue}>{scansRemaining}</Text>
          <Text style={styles.heroMeta}>scans remaining</Text>
          <Text style={styles.heroMeta}>Plan: {String(plan || 'free').toUpperCase()}</Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>CHOOSE A PLAN</Text>

        {PLANS.map((p) => (
          <Pressable key={p.key} onPress={() => buyPlan(p)} style={styles.planCard}>
            {p.tag ? (
              <View style={styles.planTag}>
                <Text style={styles.planTagText}>{p.tag}</Text>
              </View>
            ) : null}
            <View style={styles.planTop}>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planScans}>{p.scans} scans</Text>
            </View>
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>{p.priceLabel}</Text>
              <Text style={styles.planPerScan}>N{Math.round(p.price / p.scans)}/scan</Text>
            </View>
            <View style={styles.planCta}>
              <Text style={styles.planCtaText}>BUY WITH PAYSTACK</Text>
              <Text style={styles.planCtaArrow}>›</Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.sectionLabel}>PAYMENT HISTORY</Text>

        {busy ? (
          <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>No payments yet.</Text>
        ) : (
          history.map((h, i) => (
            <View key={i} style={styles.histRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.histPlan}>{String(h.plan || 'PURCHASE').toUpperCase()}</Text>
                <Text style={styles.histMeta}>{h.reference || ''}</Text>
                <Text style={styles.histMeta}>
                  {h.paid_at ? new Date(h.paid_at).toLocaleDateString() : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.histScans}>+{h.scans_added || 0}</Text>
                <Text style={styles.histAmount}>N{Number(h.amount || 0).toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          Payments processed securely by Paystack.{'\n'}
          Questions? Contact darkmoorltd@gmail.com
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  hero: { padding: 24, borderRadius: 22, marginBottom: 24 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(0,0,0,0.6)' },
  heroValue: { fontSize: 56, fontWeight: '900', color: '#000', letterSpacing: -3, marginTop: 4 },
  heroMeta: { fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 4, fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 8, marginBottom: 12 },
  planCard: { padding: 20, borderRadius: 20, backgroundColor: p.surface, marginBottom: 12, borderWidth: 1.5, borderColor: p.border, position: 'relative' },
  planTag: { position: 'absolute', top: -1, right: 20, backgroundColor: '#00ff88', paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 2 },
  planTagText: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  planName: { fontSize: 14, fontWeight: '900', color: p.text, letterSpacing: 1 },
  planScans: { fontSize: 13, fontWeight: '800', color: p.neon },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 16 },
  planPrice: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1 },
  planPerScan: { fontSize: 11, color: p.textMuted },
  planCta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  planCtaText: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  planCtaArrow: { fontSize: 18, color: p.neon, fontWeight: '300' },
  histRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: p.surface, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  histPlan: { fontSize: 13, fontWeight: '800', color: p.text },
  histMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  histScans: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  histAmount: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  emptyText: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  cta: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: p.neon, marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  footer: { fontSize: 10, color: p.textDim, textAlign: 'center', marginTop: 30, lineHeight: 16 },
});
