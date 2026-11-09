import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { walletMe } from '../src/utils/wallet';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';

export default function CareSubscribe() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [gaiaBalance, setGaiaBalance] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: plansData } = await supabase.from('care_plans').select('*');
      setPlans(plansData || []);

      if (user?.id) {
        const { data: subData } = await supabase.from('care_subscriptions').select('*').eq('user_id', user.id).maybeSingle();
        setCurrent(subData);
        
        try {
          const w = await walletMe();
          if (w?.wallet?.balance) setGaiaBalance(Number(w.wallet.balance));
        } catch {}
      }
    })();
  }, [user]);

  const initiatePayment = (plan: any) => {
    if (!user?.email) {
      Alert.alert('Error', 'User email not found. Please try again.');
      return;
    }

    Alert.alert(
      'Choose Payment Method',
      `Pay ₦${Number(plan.price_ngn).toLocaleString()} for ${plan.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: `GAIA Wallet (₦${gaiaBalance.toLocaleString()})`, 
          onPress: () => payWithWallet(plan) 
        },
        { 
          text: 'Debit Card (Paystack)', 
          onPress: () => payWithCard(plan) 
        },
      ]
    );
  };

  const payWithWallet = async (plan: any) => {
    if (gaiaBalance < Number(plan.price_ngn)) {
      Alert.alert('Insufficient Funds', `Your GAIA wallet balance is ₦${gaiaBalance.toLocaleString()}. Please top up.`);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('purchase_care_plan_with_wallet', { p_plan_id: plan.id });
      if (error) throw error;
      
      await supabase.from('meal_plans').upsert({
        user_id: user.id,
        plan_name: `${plan.name} Starter Plan`,
        daily_calories: 1800,
        foods: ['Brown Rice', 'Beans', 'Vegetables', 'Grilled Fish'],
        ai_instructions: `Welcome to ${plan.name}. I am Dr. Vinc. This plan is designed to stabilize your health.`,
        is_active: true
      });

      setGaiaBalance(data.new_balance);
      Alert.alert('Subscribed!', `You are now on ${plan.name}.`);
      router.replace('/clinical-nutrition');
    } catch (e: any) {
      Alert.alert('Payment Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const payWithCard = (plan: any) => {
    setSelectedPlan(plan);
    setPayRef('CARE_' + user.id.slice(0,6) + '_' + Date.now());
  };

  const onPayMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.status === 'success') {
        setBusy(true);
        
        const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 30);
        await supabase.from('care_subscriptions').upsert({
          user_id: user.id,
          plan: selectedPlan.id,
          price_ngn: selectedPlan.price_ngn,
          next_billing_date: nextDate.toISOString().split('T')[0],
          status: 'active',
          payment_reference: msg.reference
        }, { onConflict: 'user_id' });

        await supabase.from('meal_plans').upsert({
          user_id: user.id,
          plan_name: `${selectedPlan.name} Starter Plan`,
          daily_calories: 1800,
          foods: ['Brown Rice', 'Beans', 'Vegetables', 'Grilled Fish'],
          ai_instructions: `Welcome to ${selectedPlan.name}. I am Dr. Vinc. This plan is designed to stabilize your health. We will monitor your vitals daily.`,
          is_active: true
        });

        setBusy(false);
        setSelectedPlan(null);
        Alert.alert('Subscribed!', `You are now on ${selectedPlan.name}. Welcome to the clinic.`);
        router.replace('/clinical-nutrition');
      } else {
        setSelectedPlan(null);
      }
    } catch (e) {
      console.log('Pay error', e);
    }
  };

  const payHtml = payRef && selectedPlan && user?.email ? `
    <html><body style="margin:0;background:#000;">
    <script src="https://js.paystack.co/v1/inline.js"></script>
    <script>
      PaystackPop.setup({
        key: '${PAYSTACK_PUBLIC}',
        email: '${user.email}',
        amount: ${selectedPlan.price_ngn * 100},
        currency: 'NGN',
        ref: '${payRef}',
        callback: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'success', reference: response.reference}));
        },
        onClose: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'}));
        }
      }).openIframe();
    </script></body></html>` : '';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Dr. Vinc Care Plans</Text>
        <Text style={styles.subtitle}>Choose a plan to manage your diet and health.</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,255,136,0.08)', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)' }}>
          <Text style={{ fontSize: 13, color: palette.neon, fontWeight: '700' }}>GAIA Wallet Balance</Text>
          <Text style={{ fontSize: 18, color: palette.text, fontWeight: '900' }}>₦{gaiaBalance.toLocaleString()}</Text>
        </View>

        {current ? (
          <View style={styles.currentBox}>
            <Text style={styles.currentTitle}>Active Plan: {current.plan?.toUpperCase() || 'UNKNOWN'}</Text>
            <Text style={styles.currentSub}>Renews on {current.next_billing_date || 'N/A'}</Text>
            <Pressable onPress={() => router.push('/clinical-nutrition')} style={{ marginTop: 12, backgroundColor: '#000', padding: 10, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>GO TO CLINIC</Text>
            </Pressable>
          </View>
        ) : null}

        {plans.map(plan => (
          <View key={plan.id} style={styles.card}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>₦{Number(plan.price_ngn).toLocaleString()}<Text style={styles.perMonth}>/mo</Text></Text>
            </View>
            <View style={styles.featureList}>
              {/* FIXED: Safely handle array or string from Supabase */}
              {(Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]')).map((f: string, i: number) => (
                <Text key={i} style={styles.featureItem}>✅ {f}</Text>
              ))}
            </View>
            <Pressable onPress={() => initiatePayment(plan)} disabled={busy || current?.plan === plan.id} style={[styles.cta, current?.plan === plan.id && { backgroundColor: palette.textMuted }]}>
              {busy && selectedPlan?.id === plan.id ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>{current?.plan === plan.id ? 'CURRENT PLAN' : `SUBSCRIBE TO ${plan.name}`}</Text>}
            </Pressable>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!selectedPlan && !busy} animationType="slide" onRequestClose={() => setSelectedPlan(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable onPress={() => setSelectedPlan(null)} style={{ padding: 20, marginTop: 40 }}>
            <Text style={{ color: '#ff3b5c', fontWeight: '900', fontSize: 14 }}>CANCEL PAYMENT</Text>
          </Pressable>
          {payHtml ? <WebView source={{ html: payHtml }} onMessage={onPayMessage} style={{ flex: 1 }} javaScriptEnabled /> : null}
        </View>
      </Modal>
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
