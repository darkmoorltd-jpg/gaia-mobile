import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, Modal, RefreshControl, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

let CRYPTO_OPTIONS: any[] = [];
let CRYPTO_PLANS: Record<string, any> = {};
let payWithCrypto: any = null;
try {
  const c = require('../src/utils/crypto_payments');
  CRYPTO_OPTIONS = c.CRYPTO_OPTIONS || [];
  CRYPTO_PLANS = c.CRYPTO_PLANS || {};
  payWithCrypto = c.payWithCrypto;
} catch (e) {
  console.warn('[buy-scans] crypto unavailable', e);
}

let initiateFlutterwave: any = null;
let initiateStripe: any = null;
let verifyPurchase: any = null;
try {
  const p = require('../src/utils/purchases');
  initiateFlutterwave = p.initiateFlutterwave;
  initiateStripe = p.initiateStripe;
  verifyPurchase = p.verifyPurchase;
} catch (e) {
  console.warn('[buy-scans] purchases unavailable', e);
}

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';

type Method = 'paystack' | 'flutterwave' | 'crypto' | 'stripe';

const NGN_PLANS = [
  { key: 'starter',    name: 'Starter',    scans: 150,    naira: 3000,   annual: false },
  { key: 'pro',        name: 'Pro',        scans: 300,    naira: 5000,   annual: false },
  { key: 'business',   name: 'Business',   scans: 1000,   naira: 10000,  annual: false },
  { key: 'enterprise', name: 'Enterprise', scans: 5000,   naira: 20000,  annual: false },
  { key: 'unlimited',  name: 'Unlimited',  scans: 999999, naira: 150000, annual: true,  badge: 'BEST VALUE' },
];

const USD_PLANS = [
  { key: 'starter',    name: 'Starter',    scans: 150,    usd: 3.99,  annual: false },
  { key: 'pro',        name: 'Pro',        scans: 300,    usd: 6.99,  annual: false },
  { key: 'business',   name: 'Business',   scans: 1000,   usd: 14.99, annual: false },
  { key: 'enterprise', name: 'Enterprise', scans: 5000,   usd: 29.99, annual: false },
  { key: 'unlimited',  name: 'Unlimited',  scans: 999999, usd: 100,   annual: true,  badge: 'BEST VALUE' },
];

export default function BuyScans() {
  const router = useRouter();
  const palette = useTheme((s: any) => s.palette);
  const styles = createStyles(palette);

  const user = useAuth((s: any) => s.user);
  const scansRemaining = useAuth((s: any) => s.scansRemaining);
  const plan = useAuth((s: any) => s.plan);
  const unlimitedUntil = useAuth((s: any) => s.unlimitedUntil);
  const refreshScans = useAuth((s: any) => s.refreshScans);

  const [method, setMethod] = useState<Method>('paystack');
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paystackHtml, setPaystackHtml] = useState<string | null>(null);

  const isUnlimited =
    plan === 'unlimited' && (!unlimitedUntil || new Date(unlimitedUntil) > new Date());

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
    } catch {}
    setBusy(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshScans(); } catch {}
    await loadHistory();
  }, [refreshScans, loadHistory]);

  const payPaystack = (p: any) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    const ref = 'GAIA_' + p.key.toUpperCase() + '_' + user.id.slice(0, 6) + '_' + Date.now().toString(36);
    const html = `
      <html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://js.paystack.co/v1/inline.js"></script></head>
      <body style="margin:0;padding:30px;background:#0a0e1a;color:#fff;font-family:-apple-system,sans-serif;">
        <h2 style="color:#00ff88;">GAIA ${p.name}</h2>
        <p style="color:#8899a6;">${p.annual ? 'UNLIMITED scans — 1 year' : p.scans + ' scans'} — &#8358;${p.naira.toLocaleString()}</p>
        <button onclick="pay()" style="width:100%;padding:18px;background:#00ff88;color:#000;border:none;border-radius:14px;font-weight:900;font-size:16px;cursor:pointer;margin-top:20px;">Pay &#8358;${p.naira.toLocaleString()}</button>
        <script>
          function pay() {
            PaystackPop.setup({
              key: '${PAYSTACK_PUBLIC}',
              email: '${user.email}',
              amount: ${p.naira * 100},
              currency: 'NGN',
              ref: '${ref}',
              label: 'GAIA ${p.name}',
              callback: function(response) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success', reference: response.reference, plan: '${p.key}' }));
              },
              onClose: function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'closed' }));
              }
            }).openIframe();
          }
        </script>
      </body></html>
    `;
    setPaystackHtml(html);
  };

  const payFlutterwave = async (p: any) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (!initiateFlutterwave) { Alert.alert('Flutterwave unavailable'); return; }
    try {
      const res = await initiateFlutterwave(p.key, 'NGN');
      if (res?.checkout_url) {
        await Linking.openURL(res.checkout_url);
        Alert.alert(
          'Complete payment',
          'After paying on Flutterwave, come back to the app — scans will be credited automatically.',
          [{ text: 'OK' }],
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Flutterwave error',
        e?.message || 'Flutterwave is currently unavailable. Please use Paystack instead.',
      );
    }
  };

  const payCrypto = async (planKey: string, currency: string) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (!payWithCrypto) { Alert.alert('Crypto unavailable'); return; }
    try {
      const { data: baseline } = await supabase
        .from('user_scans')
        .select('lifetime_scans_purchased')
        .eq('user_id', user.id)
        .maybeSingle();
      const beforePurchased = baseline?.lifetime_scans_purchased || 0;

      const res = await payWithCrypto(planKey, currency);
      if (!res?.invoice_url) return;

      let attempts = 0;
      const maxAttempts = 40;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const { data: after } = await supabase
            .from('user_scans')
            .select('scans_remaining, lifetime_scans_purchased')
            .eq('user_id', user.id)
            .maybeSingle();
          const afterPurchased = after?.lifetime_scans_purchased || 0;
          if (afterPurchased > beforePurchased) {
            clearInterval(poll);
            await refreshScans();
            await loadHistory();
            Alert.alert('Payment confirmed', 'Scans have been added to your account.');
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            Alert.alert(
              'Still pending',
              "Your crypto payment hasn't been confirmed yet. It will clear automatically once the network confirms. Contact support with your order ID if not received within 1 hour.",
            );
          }
        } catch {}
      }, 15000);
    } catch (e: any) {
      Alert.alert('Crypto error', e?.message || 'Try again');
    }
  };

  const payStripe = async (p: any) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (!initiateStripe) { Alert.alert('Stripe unavailable'); return; }
    try {
      const res = await initiateStripe(p.key, 'USD');
      if (res?.checkout_url) {
        await Linking.openURL(res.checkout_url);
        Alert.alert(
          'Complete payment',
          'After paying on Stripe, come back to the app — scans will be credited automatically.',
          [{ text: 'OK' }],
        );
      }
    } catch (e: any) {
      Alert.alert('Stripe error', e?.message || 'Contact support');
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.status === 'success' && msg.reference) {
        setPaystackHtml(null);
        setVerifying(true);
        try {
          const result = await verifyPurchase(msg.reference, msg.plan);
          await refreshScans();
          await loadHistory();
          Alert.alert(
            'Payment successful',
            'Your ' + msg.plan.toUpperCase() + ' plan is active. ' +
              (result?.scans_added ? result.scans_added + ' scans added.' : ''),
          );
        } catch (e: any) {
          Alert.alert(
            'Verification failed',
            'Your payment reference is ' + msg.reference + '. Contact support with this reference.',
          );
        } finally {
          setVerifying(false);
        }
      } else if (msg.status === 'closed') {
        setPaystackHtml(null);
      }
    } catch {}
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
          <Text style={styles.heroValue}>{isUnlimited ? '\u221e' : scansRemaining}</Text>
          <Text style={styles.heroMeta}>
            {isUnlimited
              ? 'Unlimited · renews ' + new Date(unlimitedUntil || '').toLocaleDateString()
              : 'scans remaining'}
          </Text>
          <Text style={styles.heroMeta}>Plan: {String(plan || 'free').toUpperCase()}</Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {([
            { key: 'paystack',    label: 'Paystack' },
            { key: 'flutterwave', label: 'Flutterwave' },
            { key: 'crypto',      label: 'Crypto' },
            { key: 'stripe',      label: 'Stripe (USD)' },
          ] as { key: Method; label: string }[]).map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMethod(m.key)}
              style={[styles.methodChip, method === m.key && styles.methodChipOn]}
            >
              <Text style={[styles.methodChipText, method === m.key && styles.methodChipTextOn]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {(method === 'paystack' || method === 'flutterwave') && (
          <>
            <Text style={styles.sectionLabel}>CHOOSE A PLAN (NGN)</Text>
            {NGN_PLANS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => method === 'paystack' ? payPaystack(p) : payFlutterwave(p)}
                style={[styles.planCard, p.annual && styles.planCardFeatured]}
              >
                {p.annual && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{(p as any).badge || 'BEST VALUE'}</Text>
                  </View>
                )}
                <View style={styles.planTop}>
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planScans}>{p.annual ? 'UNLIMITED' : p.scans + ' scans'}</Text>
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>&#8358;{p.naira.toLocaleString()}</Text>
                  <Text style={styles.planPerScan}>
                    {p.annual ? 'per year' : '&#8358;' + Math.round(p.naira / p.scans) + '/scan'}
                  </Text>
                </View>
                <View style={styles.planCta}>
                  <Text style={styles.planCtaText}>
                    PAY WITH {method === 'paystack' ? 'PAYSTACK' : 'FLUTTERWAVE'}
                  </Text>
                  <Text style={styles.planCtaArrow}>{'>'}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {method === 'crypto' && (
          <>
            <Text style={styles.sectionLabel}>CHOOSE A PLAN (USD)</Text>
            {Object.entries(CRYPTO_PLANS).map(([key, p]: any) => (
              <View key={key} style={[styles.planCard, p.annual && styles.planCardFeatured]}>
                {p.annual && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>BEST VALUE</Text>
                  </View>
                )}
                <View style={styles.planTop}>
                  <Text style={styles.planName}>{p.label || key}</Text>
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>${p.usd}</Text>
                  <Text style={styles.planPerScan}>
                    {p.annual ? 'per year' : '$' + (p.usd / p.scans).toFixed(3) + '/scan'}
                  </Text>
                </View>
                <Text style={[styles.planPerScan, { marginBottom: 8 }]}>Pick currency:</Text>
                <View style={styles.cryptoRow}>
                  {CRYPTO_OPTIONS.map((c: any) => (
                    <Pressable
                      key={c.key}
                      onPress={() => payCrypto(key, c.key)}
                      style={styles.cryptoChip}
                    >
                      <Text style={styles.cryptoChipText}>
                        {c.emoji} {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {method === 'stripe' && (
          <>
            <Text style={styles.sectionLabel}>CHOOSE A PLAN (USD)</Text>
            {USD_PLANS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => payStripe(p)}
                style={[styles.planCard, p.annual && styles.planCardFeatured]}
              >
                {p.annual && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{(p as any).badge || 'BEST VALUE'}</Text>
                  </View>
                )}
                <View style={styles.planTop}>
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planScans}>{p.annual ? 'UNLIMITED' : p.scans + ' scans'}</Text>
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>${p.usd}</Text>
                  <Text style={styles.planPerScan}>
                    {p.annual ? 'per year' : '$' + (p.usd / p.scans).toFixed(3) + '/scan'}
                  </Text>
                </View>
                <View style={styles.planCta}>
                  <Text style={styles.planCtaText}>PAY WITH STRIPE</Text>
                  <Text style={styles.planCtaArrow}>{'>'}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

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
                <Text style={styles.histScans}>
                  {h.plan === 'unlimited' ? 'UNLIMITED' : '+' + (h.scans_added || 0)}
                </Text>
                <Text style={styles.histAmount}>&#8358;{Number(h.amount || 0).toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          Payments processed securely. Contact darkmoorltd@gmail.com for help.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!paystackHtml} animationType="slide" onRequestClose={() => setPaystackHtml(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setPaystackHtml(null)}>
              <Text style={styles.modalClose}>CLOSE</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Paystack</Text>
            <View style={{ width: 60 }} />
          </View>
          {paystackHtml && (
            <WebView
              source={{ html: paystackHtml }}
              onMessage={handleWebViewMessage}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator color={palette.neon} size="large" />
                  <Text style={styles.webviewLoadingText}>Loading Paystack...</Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
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
  methodChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginRight: 8 },
  methodChipOn: { backgroundColor: 'rgba(0,255,136,0.15)', borderColor: p.neon },
  methodChipText: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  methodChipTextOn: { color: p.neon },
  planCard: { padding: 20, borderRadius: 20, backgroundColor: p.surface, marginBottom: 12, borderWidth: 1.5, borderColor: p.border, position: 'relative' },
  planCardFeatured: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.05)' },
  planBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: p.neon, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  planBadgeText: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  planName: { fontSize: 14, fontWeight: '900', color: p.text, letterSpacing: 1 },
  planScans: { fontSize: 13, fontWeight: '800', color: p.neon },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 16 },
  planPrice: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1 },
  planPerScan: { fontSize: 11, color: p.textMuted },
  planCta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  planCtaText: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  planCtaArrow: { fontSize: 18, color: p.neon, fontWeight: '300' },
  cryptoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  cryptoChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: p.border },
  cryptoChipText: { fontSize: 11, fontWeight: '700', color: p.text },
  histRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: p.surface, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  histPlan: { fontSize: 13, fontWeight: '800', color: p.text },
  histMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  histScans: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  histAmount: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  emptyText: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  cta: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: p.neon, marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  footer: { fontSize: 10, color: p.textDim, textAlign: 'center', marginTop: 30, lineHeight: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#1a2820' },
  modalClose: { fontSize: 11, fontWeight: '900', color: '#00ff88', letterSpacing: 1.5 },
  modalTitle: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  webviewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0e1a' },
  webviewLoadingText: { color: '#fff', marginTop: 12, fontSize: 13 },
});
