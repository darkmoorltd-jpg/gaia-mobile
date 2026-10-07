import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, Modal, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Screen, GlassCard } from '../src/components';
import { useTheme, typography, spacing, radius, shadows } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';

interface Tier {
  tier: string;
  price_naira: number;
  loan_limit_naira: number;
  insurance_discount_pct: number;
  marketplace_featured: boolean;
  priority_support: boolean;
  free_scans_monthly: number;
  benefits: string[];
}

const TIER_META: Record<string, { emoji: string; colors: [string, string] }> = {
  bronze:   { emoji: '🥉', colors: ['#7a5230', '#c68a5c'] },
  silver:   { emoji: '🥈', colors: ['#4a5459', '#b0bec5'] },
  gold:     { emoji: '🥇', colors: ['#8a6900', '#ffd700'] },
  platinum: { emoji: '💎', colors: ['#3a3540', '#e5e4e2'] },
};

const fmtN = (n: number) => '₦' + Number(n || 0).toLocaleString('en-NG');

export default function Badges() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [paystackTier, setPaystackTier] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || '';
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [t, c] = await Promise.all([
        supabase.rpc('badge_tiers'),
        fetch(API_BASE + '/badge/current', { headers: await authHeader() })
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
      ]);
      setTiers(t.data || []);
      setCurrent(c);
    } catch (e) {
      console.log('badge load', e);
    } finally {
      setBusy(false);
    }
  }, [user, authHeader]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startPurchase = async (tier: string) => {
    try {
      const r = await fetch(API_BASE + '/badge/subscribe', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ tier, user_email: user?.email || '' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Could not start purchase');
      setPaystackRef(d.reference);
      setPaystackTier(tier);
    } catch (e: any) {
      Alert.alert('Subscribe failed', e?.message || 'Try again');
    }
  };

  const verifyNow = async (reference: string) => {
    setVerifying(true);
    try {
      const r = await fetch(API_BASE + '/badge/verify', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ reference }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Verification failed');
      setPaystackRef(null);
      setPaystackTier(null);
      Alert.alert('Badge activated', 'Your badge is now live.');
      load();
    } catch (e: any) {
      Alert.alert('Verification failed', e?.message || 'Contact support with your reference');
    } finally {
      setVerifying(false);
    }
  };

  const cancelRenewal = () => {
    Alert.alert(
      'Cancel auto-renewal?',
      'Your badge stays active until it expires. You will not be charged again.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel renewal', style: 'destructive', onPress: async () => {
          const r = await fetch(API_BASE + '/badge/cancel-renewal', {
            method: 'POST',
            headers: await authHeader(),
          });
          if (r.ok) { Alert.alert('Done', 'Auto-renewal cancelled.'); load(); }
        }},
      ],
    );
  };

  const paystackHTML = () => {
    const amount = tiers.find((t) => t.tier === paystackTier)?.price_naira || 0;
    const email = user?.email || '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <script src="https://js.paystack.co/v1/inline.js"></script></head>
      <body style="background:#000;margin:0">
      <script>
        window.addEventListener('load', function() {
          try {
            var handler = PaystackPop.setup({
              key: '${PAYSTACK_PUBLIC}',
              email: '${email}',
              amount: ${amount * 100},
              currency: 'NGN',
              ref: '${paystackRef}',
              label: 'GAIA ${paystackTier || ''} badge',
              onClose: function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'closed' }));
              },
              callback: function(response) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success', reference: response.reference }));
              }
            });
            handler.openIframe();
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'error', message: String(e) }));
          }
        });
      </script></body></html>`;
  };

  const onPaystackMessage = (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (d.status === 'success' && d.reference) {
        verifyNow(d.reference);
      } else {
        setPaystackRef(null);
        setPaystackTier(null);
      }
    } catch {
      setPaystackRef(null);
      setPaystackTier(null);
    }
  };

  if (!user) {
    return <Screen glow="livestock"><Text style={{ color: palette.text }}>Please log in.</Text></Screen>;
  }

  const tierMeta = current?.tier ? TIER_META[current.tier] : null;
  const activeTier = tiers.find((t) => t.tier === current?.tier);

  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.subtitle}>Unlock bigger loans, discounts, and priority service.</Text>

        {busy && !current ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {current?.is_active && tierMeta && activeTier ? (
          <LinearGradient colors={tierMeta.colors} style={styles.currentBadge}>
            <Text style={styles.currentEmoji}>{tierMeta.emoji}</Text>
            <Text style={styles.currentName}>{String(current.tier).toUpperCase()}</Text>
            <Text style={styles.currentSub}>
              Expires in {current.days_left != null ? current.days_left : '—'} days
            </Text>
            <Text style={styles.currentSub}>Loan limit {fmtN(activeTier.loan_limit_naira)}</Text>
            {current.auto_renew ? (
              <Pressable onPress={cancelRenewal} style={styles.cancelRenewBtn}>
                <Text style={styles.cancelRenewText}>Auto-renews · tap to cancel</Text>
              </Pressable>
            ) : (
              <Text style={styles.cancelRenewText}>Auto-renewal OFF</Text>
            )}
          </LinearGradient>
        ) : (
          <GlassCard style={{ marginTop: spacing.xl, padding: spacing.xxl, alignItems: 'center' }}>
            <Text style={styles.noBadgeEmoji}>⭕</Text>
            <Text style={styles.noBadgeTitle}>No active badge</Text>
            <Text style={styles.noBadgeSub}>
              Subscribe below. First month unlocks immediately.
            </Text>
          </GlassCard>
        )}

        <Text style={styles.sectionLabel}>
          {current?.is_active ? 'UPGRADE OR SWITCH' : 'CHOOSE YOUR TIER'}
        </Text>

        {tiers.map((t) => {
          const meta = TIER_META[t.tier];
          const isCurrent = current?.is_active && current.tier === t.tier;
          return (
            <Pressable
              key={t.tier}
              onPress={() => !isCurrent && startPurchase(t.tier)}
              disabled={isCurrent}
              style={{ marginBottom: spacing.md }}
            >
              <View style={[styles.badgeRow, isCurrent && styles.badgeRowCurrent]}>
                <LinearGradient colors={meta.colors as any} style={styles.badgeIconWrap}>
                  <Text style={styles.badgeEmoji}>{meta.emoji}</Text>
                </LinearGradient>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.badgeName}>{String(t.tier).toUpperCase()}</Text>
                    {isCurrent ? <Text style={styles.currentChip}>CURRENT</Text> : null}
                  </View>
                  <Text style={styles.badgeLoan}>Loan {fmtN(t.loan_limit_naira)}</Text>
                  <Text style={styles.badgeLoan}>
                    {t.insurance_discount_pct}% insurance discount · {t.free_scans_monthly} scans/mo
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.badgePrice}>{fmtN(t.price_naira)}/mo</Text>
                  <View style={[styles.selectBtn, isCurrent && { opacity: 0.4 }]}>
                    <Text style={styles.selectTxt}>{isCurrent ? 'ACTIVE' : 'SUBSCRIBE'}</Text>
                  </View>
                </View>
              </View>

              {t.benefits && t.benefits.length > 0 ? (
                <View style={styles.benefitsBox}>
                  {t.benefits.map((b, i) => (
                    <Text key={i} style={styles.benefitLine}>•  {b}</Text>
                  ))}
                </View>
              ) : null}
            </Pressable>
          );
        })}

        <Pressable onPress={() => router.push('/wallet' as any)} style={styles.walletLink}>
          <Text style={styles.walletLinkText}>View wallet</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={!!paystackRef} animationType="slide" transparent onRequestClose={() => setPaystackRef(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setPaystackRef(null)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
            <WebView
              originWhitelist={['*']}
              source={{ html: paystackHTML() }}
              onMessage={(e) => onPaystackMessage(e.nativeEvent.data)}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              style={{ flex: 1, backgroundColor: '#000' }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={verifying} transparent>
        <View style={styles.verifyingBg}>
          <View style={styles.verifyingBox}>
            <ActivityIndicator color={palette.neon} size="large" />
            <Text style={styles.verifyingText}>Verifying payment…</Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  backBtn: { marginBottom: spacing.md },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: palette.textMuted },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },

  currentBadge: { borderRadius: radius.xl, padding: spacing.xxl, marginTop: spacing.lg, alignItems: 'center', ...shadows.neon },
  currentEmoji: { fontSize: 64 },
  currentName: { fontSize: 32, fontWeight: '900', color: '#000', letterSpacing: 3, marginTop: 6 },
  currentSub: { ...typography.micro, color: 'rgba(0,0,0,0.75)', marginTop: 6, fontWeight: '700' },
  cancelRenewBtn: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.15)' },
  cancelRenewText: { fontSize: 10, color: 'rgba(0,0,0,0.7)', marginTop: 8, fontWeight: '700' },

  noBadgeEmoji: { fontSize: 48 },
  noBadgeTitle: { fontSize: 18, fontWeight: '900', color: palette.text, marginTop: 8 },
  noBadgeSub: { ...typography.caption, color: palette.textMuted, marginTop: 4, textAlign: 'center' },

  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xxl, marginBottom: spacing.lg, fontWeight: '800', letterSpacing: 1.5 },

  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  badgeRowCurrent: { borderColor: palette.neon },
  badgeIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 28 },
  badgeName: { ...typography.body, color: palette.text, fontWeight: '900', letterSpacing: 1.2 },
  currentChip: { fontSize: 8, fontWeight: '900', color: palette.obsidian, backgroundColor: palette.neon, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, letterSpacing: 1 },
  badgeLoan: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  badgePrice: { ...typography.caption, color: palette.neon, fontWeight: '900' },
  selectBtn: { marginTop: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.borderHi },
  selectTxt: { fontSize: 10, fontWeight: '900', color: palette.neon, letterSpacing: 1 },

  benefitsBox: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg,
    borderWidth: 1, borderTopWidth: 0, borderColor: palette.border,
  },
  benefitLine: { ...typography.micro, color: palette.textMuted, marginTop: 2 },

  walletLink: { marginTop: spacing.xl, padding: 14, alignItems: 'center' },
  walletLinkText: { fontSize: 12, fontWeight: '800', color: palette.neon, letterSpacing: 1.2 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  modalSheet: { flex: 1, marginTop: 60, backgroundColor: palette.obsidian, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalClose: { padding: 14, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border },
  modalCloseText: { fontSize: 12, fontWeight: '900', color: palette.textMuted, letterSpacing: 1.2 },

  verifyingBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  verifyingBox: { padding: 32, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center' },
  verifyingText: { color: palette.text, marginTop: 14, fontWeight: '700' },
});
