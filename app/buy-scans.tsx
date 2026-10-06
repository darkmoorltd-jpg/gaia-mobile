import { useState } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { fetchPlans, verifyPurchase, newRef, type Plan } from '../src/utils/purchases';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const num = (n: any) => Number(n || 0).toLocaleString('en-NG');

export default function BuyScans() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const scansRemaining = useAuth((s: any) => s.scansRemaining);
  const plan = useAuth((s: any) => s.plan);
  const refreshScans = useAuth((s: any) => s.refreshScans);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualRef, setManualRef] = useState('');
  const [manualPlan, setManualPlan] = useState<string>('starter');

  const loadPlans = useCallback(async () => {
    setBusy(true);
    try {
      const p = await fetchPlans();
      setPlans(p);
    } catch (e) { console.log('plans load failed', e); }
    setBusy(false);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const r = await supabase.from('payment_history')
        .select('amount, scans_added, plan, reference, paid_at')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false })
        .limit(5);
      if (!r.error) setHistory(r.data || []);
    } catch {}
  }, [user]);

  useEffect(() => {
    loadPlans();
    loadHistory();
  }, [loadPlans, loadHistory]);

  const startPay = (p: Plan) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    setSelected(p);
    setPayRef(newRef(p.key, user.id));
  };

  const cancelPay = () => { setSelected(null); setPayRef(null); };

  const html = () => {
    if (!selected || !payRef) return '';
    const email = user && user.email ? user.email : '';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>' +
      '<script src="https://js.paystack.co/v1/inline.js"></script>' +
      '<style>html,body{margin:0;padding:0;background:#0a0e0c}</style></head><body><script>' +
      'window.addEventListener("load", function() {' +
      '  try {' +
      '    PaystackPop.setup({' +
      '      key: "' + PAYSTACK_PUBLIC + '",' +
      '      email: "' + email + '",' +
      '      amount: ' + selected.amount_kobo + ',' +
      '      currency: "NGN",' +
      '      ref: "' + payRef + '",' +
      '      label: "GAIA ' + selected.name + '",' +
      '      onClose: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ status: "closed" })); },' +
      '      callback: function(response) { window.ReactNativeWebView.postMessage(JSON.stringify({ status: "success", reference: response.reference })); }' +
      '    }).openIframe();' +
      '  } catch (err) {' +
      '    window.ReactNativeWebView.postMessage(JSON.stringify({ status: "error", message: String(err) }));' +
      '  }' +
      '});' +
      '</script></body></html>';
  };

  const onMessage = async (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (d.status === 'closed') { cancelPay(); return; }
      if (d.status === 'error') { Alert.alert('Paystack error', d.message); cancelPay(); return; }
      if (d.status === 'success' && selected) {
        setVerifying(true);
        try {
          const res = await verifyPurchase(d.reference, selected.key);
          await refreshScans();
          await loadHistory();
          setSuccess({ ...res, plan_name: selected.name });
          setSelected(null);
          setPayRef(null);
        } catch (e: any) {
          Alert.alert('Verification failed', (e && e.message ? e.message : 'Contact support') + '\nRef: ' + d.reference);
        } finally {
          setVerifying(false);
        }
      }
    } catch {}
  };

  const doManualVerify = async () => {
    if (!manualRef.trim()) { Alert.alert('Enter a reference'); return; }
    setVerifying(true);
    try {
      const res = await verifyPurchase(manualRef.trim(), manualPlan);
      await refreshScans();
      await loadHistory();
      setSuccess({ ...res, plan_name: manualPlan.toUpperCase() });
      setShowManual(false);
      setManualRef('');
    } catch (e: any) {
      Alert.alert('Verification failed', e && e.message ? e.message : 'Check the reference');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>Buy Scans</Text>
        <Text style={styles.sub}>Instant top-up. Pay inside the app.</Text>

        <LinearGradient
          colors={['#00c853', '#009e52', '#003820']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>CURRENT BALANCE</Text>
          <Text style={styles.heroValue}>{num(scansRemaining)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{String(plan || 'free').toUpperCase()}</Text>
            </View>
            <Text style={styles.heroMeta}>scans available</Text>
          </View>
        </LinearGradient>

        {history.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>RECENT PURCHASES</Text>
            {history.map((h, i) => (
              <View key={i} style={styles.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histPlan}>{String(h.plan || '').toUpperCase()}</Text>
                  <Text style={styles.histMeta}>{h.paid_at ? new Date(h.paid_at).toLocaleString() : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.histScans}>+{num(h.scans_added)}</Text>
                  <Text style={styles.histAmount}>N{num(h.amount)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {plans.map((p) => {
          const isPopular = p.key === 'pro';
          const isBest = p.key === 'enterprise';
          const perScan = p.scans > 0 ? (p.amount_kobo / 100 / p.scans) : 0;
          return (
            <Pressable
              key={p.key}
              onPress={() => startPay(p)}
              style={({ pressed }) => [styles.planCard, pressed && { opacity: 0.85 }]}
            >
              {(isPopular || isBest) ? (
                <View style={[styles.planTag, isBest && { backgroundColor: '#ffb300' }]}>
                  <Text style={[styles.planTagText, isBest && { color: '#000' }]}>
                    {isBest ? 'BEST VALUE' : 'POPULAR'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.planTop}>
                <Text style={styles.planName}>{p.name.toUpperCase()}</Text>
                <Text style={styles.planScans}>{num(p.scans)} scans</Text>
              </View>

              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>N{num(p.amount_kobo / 100)}</Text>
                <Text style={styles.planPerScan}>N{perScan.toFixed(1)} / scan</Text>
              </View>

              <View style={styles.planCta}>
                <Text style={styles.planCtaText}>PAY NOW</Text>
                <Text style={styles.planCtaArrow}>-</Text>
              </View>
            </Pressable>
          );
        })}

        <Pressable onPress={() => setShowManual(true)} style={styles.manualLink}>
          <Text style={styles.manualLinkText}>Already paid? Enter reference</Text>
        </Pressable>

        <Text style={styles.footer}>Secure payment via Paystack - secret key held server-side</Text>

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!selected && !!payRef} animationType="slide" onRequestClose={cancelPay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={cancelPay}><Text style={styles.modalClose}>CLOSE</Text></Pressable>
            <Text style={styles.modalTitle}>{selected ? 'PAYING ' + selected.name.toUpperCase() : ''}</Text>
            <View style={{ width: 50 }} />
          </View>

          {verifying ? (
            <View style={styles.modalCenter}>
              <ActivityIndicator color="#00ff88" size="large" />
              <Text style={styles.modalCenterText}>Verifying payment...</Text>
            </View>
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html: html() }}
              onMessage={(e) => onMessage(e.nativeEvent.data)}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              style={{ flex: 1, backgroundColor: '#0a0e0c' }}
            />
          )}
        </View>
      </Modal>

      <Modal visible={showManual} animationType="slide" transparent onRequestClose={() => setShowManual(false)}>
        <View style={styles.manualBg}>
          <View style={styles.manualSheet}>
            <Text style={styles.manualTitle}>Enter Payment Reference</Text>
            <Text style={styles.manualSub}>Paste the reference from your Paystack email or SMS.</Text>

            <Text style={styles.manualLabel}>PLAN</Text>
            <View style={styles.manualChips}>
              {plans.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => setManualPlan(p.key)}
                  style={[styles.manualChip, manualPlan === p.key && styles.manualChipOn]}
                >
                  <Text style={[styles.manualChipText, manualPlan === p.key && styles.manualChipTextOn]}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.manualLabel}>REFERENCE</Text>
            <TextInput
              value={manualRef}
              onChangeText={setManualRef}
              placeholder="GAIA_STARTER_..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.manualInput}
              autoCapitalize="characters"
            />

            <Pressable onPress={doManualVerify} disabled={verifying} style={[styles.manualBtn, verifying && { opacity: 0.5 }]}>
              {verifying ? <ActivityIndicator color="#000" /> : <Text style={styles.manualBtnText}>VERIFY and CREDIT</Text>}
            </Pressable>

            <Pressable onPress={() => setShowManual(false)} style={styles.manualCancel}>
              <Text style={styles.manualCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!success} animationType="fade" transparent onRequestClose={() => setSuccess(null)}>
        <View style={styles.successBg}>
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>OK</Text>
            <Text style={styles.successTitle}>Payment Successful</Text>
            {success ? (
              <>
                <Text style={styles.successPlan}>{String(success.plan_name || '').toUpperCase()}</Text>
                <Text style={styles.successScans}>+{num(success.scans_added)}</Text>
                <Text style={styles.successBalance}>New balance: {num(success.scans_remaining)} scans</Text>
              </>
            ) : null}
            <Pressable onPress={() => setSuccess(null)} style={styles.successBtn}>
              <Text style={styles.successBtnText}>DONE</Text>
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
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4 },
  hero: { marginTop: 20, padding: 24, borderRadius: 22, overflow: 'hidden' },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' },
  heroValue: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -3, marginTop: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  heroBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  heroMeta: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  histRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: p.surface, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: p.border },
  histPlan: { fontSize: 13, fontWeight: '800', color: p.text },
  histMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  histScans: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  histAmount: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  planCard: { padding: 20, borderRadius: 20, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1.5, borderColor: p.border, position: 'relative' },
  planTag: { position: 'absolute', top: -1, right: 20, backgroundColor: '#00ff88', paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 2 },
  planTagText: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  planName: { fontSize: 12, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5 },
  planScans: { fontSize: 13, fontWeight: '800', color: '#00ff88' },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 16 },
  planPrice: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1 },
  planPerScan: { fontSize: 11, color: p.textMuted },
  planCta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  planCtaText: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  planCtaArrow: { fontSize: 18, color: p.neon, fontWeight: '300' },
  manualLink: { marginTop: 12, padding: 14, alignItems: 'center' },
  manualLinkText: { fontSize: 12, fontWeight: '700', color: p.neon, textDecorationLine: 'underline' },
  footer: { fontSize: 10, color: p.textDim, textAlign: 'center', marginTop: 16 },
  modalContainer: { flex: 1, backgroundColor: '#0a0e0c' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#1a2820' },
  modalClose: { fontSize: 11, fontWeight: '900', color: '#00ff88', letterSpacing: 1.5 },
  modalTitle: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  modalCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  modalCenterText: { fontSize: 14, color: '#00ff88', fontWeight: '700' },
  manualBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  manualSheet: { backgroundColor: '#0f1512', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  manualTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  manualSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 20 },
  manualLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginTop: 16, marginBottom: 8 },
  manualChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  manualChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  manualChipOn: { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.12)' },
  manualChipText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  manualChipTextOn: { color: '#00ff88' },
  manualInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#fff', fontSize: 14 },
  manualBtn: { marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  manualBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  manualCancel: { marginTop: 12, padding: 12, alignItems: 'center' },
  manualCancelText: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  successBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  successCard: { width: '100%', padding: 32, borderRadius: 24, backgroundColor: '#0f1512', alignItems: 'center', borderWidth: 1.5, borderColor: '#00ff88' },
  successIcon: { fontSize: 40, color: '#00ff88', fontWeight: '900', letterSpacing: 2 },
  successTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 12 },
  successPlan: { fontSize: 12, fontWeight: '900', color: '#00ff88', letterSpacing: 2, marginTop: 20 },
  successScans: { fontSize: 52, fontWeight: '900', color: '#00ff88', letterSpacing: -3, marginTop: 8 },
  successBalance: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10 },
  successBtn: { marginTop: 24, paddingVertical: 16, paddingHorizontal: 60, borderRadius: 12, backgroundColor: '#00ff88' },
  successBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
});
