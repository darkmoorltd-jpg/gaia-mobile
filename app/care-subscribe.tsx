import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import * as FileSystem from 'expo-file-system/legacy';

export default function CareSubscribe() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: plansData } = await supabase.from('care_plans').select('*');
      setPlans(plansData || []);

      const { data: subData } = await supabase.from('care_subscriptions').select('*').eq('user_id', user?.id).maybeSingle();
      setCurrent(subData);
    })();
  }, [user]);

  const subscribe = async (plan: any) => {
    setBusy(plan.id);
    // In production: Use Paystack here to charge the card
    const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 30);

    const { error } = await supabase.from('care_subscriptions').upsert({
      user_id: user.id,
      plan: plan.id,
      price_ngn: plan.price_ngn,
      next_billing_date: nextDate.toISOString().split('T')[0],
      status: 'active'
    }, { onConflict: 'user_id' });

    setBusy(null);
    if (error) Alert.alert('Failed', error.message);
    else Alert.alert('Subscribed!', `You are now on ${plan.name}.`);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Dr. Vinc Care Plans</Text>
        <Text style={styles.subtitle}>Choose a plan to manage your diet and health.</Text>

        {current ? (
          <View style={styles.currentBox}>
            <Text style={styles.currentTitle}>Active Plan: {current.plan.toUpperCase()}</Text>
            <Text style={styles.currentSub}>Renews on {current.next_billing_date}</Text>
          </View>
        ) : null}

        {plans.map(plan => (
          <View key={plan.id} style={styles.card}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>₦{Number(plan.price_ngn).toLocaleString()}<Text style={styles.perMonth}>/mo</Text></Text>
            </View>
            <View style={styles.featureList}>
              {JSON.parse(plan.features || '[]').map((f: string, i: number) => (
                <Text key={i} style={styles.featureItem}>✅ {f}</Text>
              ))}
            </View>
            <Pressable onPress={() => subscribe(plan)} disabled={busy === plan.id || current?.plan === plan.id} style={[styles.cta, current?.plan === plan.id && { backgroundColor: p.textMuted }]}>
              {busy === plan.id ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>{current?.plan === plan.id ? 'CURRENT PLAN' : `SUBSCRIBE TO ${plan.name}`}</Text>}
            </Pressable>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  currentBox: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.neon, marginBottom: 20 },
  currentTitle: { fontSize: 14, fontWeight: '900', color: p.neon },
  currentSub: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  card: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  planName: { fontSize: 20, fontWeight: '900', color: p.text },
  planPrice: { fontSize: 22, fontWeight: '900', color: p.neon },
  perMonth: { fontSize: 12, color: p.textMuted, fontWeight: '400' },
  featureList: { marginBottom: 20 },
  featureItem: { fontSize: 13, color: p.text, marginBottom: 8, lineHeight: 20 },
  cta: { backgroundColor: p.neon, padding: 16, borderRadius: 12, alignItems: 'center' },
  ctaTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
