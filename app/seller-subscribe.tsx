import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function SellerSubscribe() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [tiers, setTiers] = useState<any[]>([]);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');
  const [verification, setVerification] = useState<any>(null);
  const [hasInspection, setHasInspection] = useState(false);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [{ data: t }, { data: v }, { data: i }, { data: s }] = await Promise.all([
      supabase.from('seller_tiers').select('*').order('search_rank'),
      supabase.from('seller_verifications').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('seller_inspections').select('id').eq('user_id', user.id).eq('status', 'approved').limit(1),
      supabase.from('seller_subscriptions').select('*, seller_tiers(name)').eq('user_id', user.id).eq('status', 'active').gt('period_end', new Date().toISOString()).maybeSingle(),
    ]);
    setTiers(t || []);
    setVerification(v);
    setHasInspection(!!(i && i.length > 0));
    setActiveSub(s);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subscribe = async (tier: any) => {
    if (!verification || verification.status !== 'approved') {
      Alert.alert('Verification required', 'Complete identity verification first.', [
        { text: 'Verify now', onPress: () => router.push('/seller-verify' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (tier.requires_inspection && !hasInspection) {
      Alert.alert('Inspection required', `${tier.name} tier requires an approved farm inspection. Contact support to schedule one.`);
      return;
    }
    if (tier.monthly_price === 0 && cycle === 'monthly') {
      Alert.alert('Annual only', `${tier.name} tier is annual-only.`);
      return;
    }

    setSubscribing(tier.id);
    try {
      const { data: intent, error: iErr } = await supabase.rpc('initiate_tier_subscription', {
        p_tier_id: tier.id,
        p_billing_cycle: cycle,
      });
      if (iErr) throw iErr;
      if (!intent?.ok) throw new Error('Payment init failed');

      const { data: charge, error: cErr } = await supabase.functions.invoke('charge-tier-subscription', {
        body: { reference: intent.reference },
      });
      if (cErr) throw cErr;
      if (!charge?.ok) throw new Error(charge?.error || 'Paystack init failed');

      const r = await WebBrowser.openAuthSessionAsync(charge.authorization_url, 'gaia://seller-subscribe');
      if (r.type !== 'success') return;

      // Poll for webhook + activate
      let activated = false;
      for (let i = 0; i < 15; i++) {
        await new Promise(res => setTimeout(res, 1000));
        const { data: act, error: aErr } = await supabase.rpc('activate_tier_subscription', {
          p_reference: intent.reference,
        });
        if (!aErr && act?.ok) {
          activated = true;
          Alert.alert('Welcome!', `You're on ${tier.name} tier. Start listing.`, [
            { text: 'Go to dashboard', onPress: () => router.replace('/seller-dashboard' as any) },
          ]);
          break;
        }
        if (aErr && !aErr.message.includes('payment not verified')) throw aErr;
      }
      if (!activated) throw new Error('Payment is being confirmed. Reopen the app in 1 minute.');
    } catch (e: any) {
      Alert.alert('Subscribe failed', e.message);
    } finally {
      setSubscribing(null);
    }
  };

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.sub}>
          {verification?.status === 'approved'
            ? hasInspection ? 'All tiers unlocked.' : 'Basic unlocked. Premium & Organic require farm inspection.'
            : 'Complete identity verification to subscribe.'}
        </Text>

        {verification?.status !== 'approved' ? (
          <Pressable onPress={() => router.push('/seller-verify' as any)} style={styles.warnBox}>
            <Text style={styles.warnTxt}>⚠ Verify your identity first →</Text>
          </Pressable>
        ) : null}

        {activeSub ? (
          <View style={styles.activeBox}>
            <Text style={styles.activeLbl}>CURRENT PLAN</Text>
            <Text style={styles.activeVal}>{activeSub.seller_tiers?.name || activeSub.tier_id}</Text>
            <Text style={styles.activeMeta}>Expires {new Date(activeSub.period_end).toLocaleDateString()}</Text>
          </View>
        ) : null}

        <View style={styles.cycleRow}>
          <Pressable onPress={() => setCycle('monthly')} style={[styles.cycleBtn, cycle === 'monthly' && styles.cycleOn]}>
            <Text style={[styles.cycleTxt, cycle === 'monthly' && styles.cycleTxtOn]}>Monthly</Text>
          </Pressable>
          <Pressable onPress={() => setCycle('annual')} style={[styles.cycleBtn, cycle === 'annual' && styles.cycleOn]}>
            <Text style={[styles.cycleTxt, cycle === 'annual' && styles.cycleTxtOn]}>Annual (save 17%)</Text>
          </Pressable>
        </View>

        {tiers.map(t => {
          const isAnnualOnly = t.monthly_price === 0;
          const price = cycle === 'monthly' ? t.monthly_price : t.annual_price;
          const needsInspection = t.requires_inspection && !hasInspection;
          const isActive = activeSub?.tier_id === t.id;
          const locked = verification?.status !== 'approved' || needsInspection || (isAnnualOnly && cycle === 'monthly');

          return (
            <View key={t.id} style={[styles.tierCard, isActive && styles.tierActive, locked && { opacity: 0.55 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.tierName}>{t.name}</Text>
                {t.badge ? <Text style={styles.badge}>{t.badge}</Text> : null}
              </View>
              <Text style={styles.tierPrice}>
                ₦{Number(price || 0).toLocaleString()}
                <Text style={styles.tierPer}> {cycle === 'monthly' ? '/mo' : '/yr'}</Text>
              </Text>
              <Text style={styles.tierCommission}>
                GAIA takes {t.commission_pct}% · You keep {100 - t.commission_pct}%
              </Text>
              <View style={styles.tierFeatures}>
                <Text style={styles.feat}>• Up to {t.max_products === -1 ? 'unlimited' : t.max_products} products</Text>
                <Text style={styles.feat}>• ₦{(t.max_price_per_listing / 1000000).toFixed(1)}M per listing max</Text>
                {t.requires_inspection ? <Text style={styles.feat}>• Farm inspection required</Text> : null}
                {t.requires_residue_test ? <Text style={styles.feat}>• Residue lab test required</Text> : null}
              </View>
              {isAnnualOnly ? <Text style={styles.annualOnly}>Annual only</Text> : null}
              {needsInspection ? <Text style={styles.annualOnly}>Inspection required</Text> : null}

              {isActive ? (
                <View style={styles.activePill}><Text style={styles.activePillTxt}>CURRENT</Text></View>
              ) : (
                <Pressable
                  onPress={() => subscribe(t)}
                  disabled={locked || subscribing === t.id}
                  style={[styles.cta, locked && { opacity: 0.4 }]}
                >
                  {subscribing === t.id ? <ActivityIndicator color="#000" /> :
                    <Text style={styles.ctaTxt}>
                      {verification?.status !== 'approved' ? 'VERIFY FIRST' : needsInspection ? 'INSPECTION REQUIRED' : `SUBSCRIBE ₦${Number(price || 0).toLocaleString()}`}
                    </Text>}
                </Pressable>
              )}
            </View>
          );
        })}

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
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 20, lineHeight: 19 },
  warnBox: { backgroundColor: 'rgba(255,179,0,0.12)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ffb300', marginBottom: 16 },
  warnTxt: { color: '#ffb300', fontSize: 13, fontWeight: '800' },
  activeBox: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.neon, marginBottom: 16 },
  activeLbl: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  activeVal: { fontSize: 20, fontWeight: '900', color: p.text, marginTop: 6 },
  activeMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  cycleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  cycleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  cycleOn: { backgroundColor: p.neon, borderColor: p.neon },
  cycleTxt: { fontSize: 12, fontWeight: '800', color: p.textMuted },
  cycleTxtOn: { color: '#000' },
  tierCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  tierActive: { borderColor: p.neon, borderWidth: 2 },
  tierName: { fontSize: 20, fontWeight: '900', color: p.text },
  badge: { fontSize: 11, fontWeight: '800', color: p.neon, backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tierPrice: { fontSize: 32, fontWeight: '900', color: p.text, marginTop: 8 },
  tierPer: { fontSize: 14, fontWeight: '600', color: p.textMuted },
  tierCommission: { fontSize: 12, color: p.neon, fontWeight: '700', marginTop: 4 },
  tierFeatures: { marginTop: 12, gap: 4 },
  feat: { fontSize: 12, color: p.text, lineHeight: 18 },
  annualOnly: { fontSize: 11, color: '#ffb300', fontWeight: '800', marginTop: 10 },
  cta: { marginTop: 16, backgroundColor: p.neon, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  ctaTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  activePill: { marginTop: 16, backgroundColor: 'rgba(0,255,136,0.2)', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  activePillTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1 },
});
