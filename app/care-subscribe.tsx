import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Modal, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { walletMe } from '../src/utils/wallet';

const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';

export default function CareSubscribe() {
  const router = useRouter();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles();

  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [gaiaBalance, setGaiaBalance] = useState<number>(0);
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: plansData } = await supabase.from('care_plans').select('*');
      setPlans(plansData || []);
      if (user?.id) {
        const { data: subData } = await supabase.from('care_subscriptions').select('*').eq('user_id', user.id).maybeSingle();
        setCurrent(subData);
        try { const w = await walletMe(); if (w?.wallet?.balance) setGaiaBalance(Number(w.wallet.balance)); } catch {}
      }
    })();
  }, [user]);

  const getPrice = (plan: any) => {
    const monthly = Number(plan.price_ngn);
    if (!isYearly) return monthly;
    // Yearly: Pay for 10 months, get 12 (Save 17%)
    return monthly * 10; 
  };

  const initiatePayment = (plan: any) => {
    if (!user?.email) return;
    const price = getPrice(plan);
    Alert.alert(
      'Choose Payment Method',
      `Pay ₦${price.toLocaleString()} for ${plan.name} (${isYearly ? 'Yearly' : 'Monthly'})`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `GAIA Wallet (₦${gaiaBalance.toLocaleString()})`, onPress: () => payWithWallet(plan, price) },
        { text: 'Debit Card (Paystack)', onPress: () => payWithCard(plan, price) },
      ]
    );
  };

  const payWithWallet = async (plan: any, price: number) => {
    if (gaiaBalance < price) {
      Alert.alert('Insufficient Funds', 'Please top up your wallet.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('purchase_care_plan_with_wallet', { p_plan_id: plan.id });
      if (error) throw error;
      
      // In a real app, you'd update the yearly status here in DB. For now, we simulate it.
      await supabase.from('meal_plans').upsert({
        user_id: user.id, plan_name: `${plan.name} Starter Plan`, daily_calories: 1800,
        foods: ['Brown Rice', 'Beans', 'Vegetables', 'Grilled Fish'],
        ai_instructions: `Welcome to ${plan.name}. I am Dr. Vinc.`, is_active: true
      });

      setGaiaBalance(data.new_balance);
      Alert.alert('Subscribed!', `You are now on ${plan.name}.`);
      router.replace('/clinical-nutrition');
    } catch (e: any) {
      Alert.alert('Payment Failed', e.message);
    } finally { setBusy(false); }
  };

  const payWithCard = (plan: any, price: number) => {
    setSelectedPlan({ ...plan, price_to_pay: price });
    setPayRef('CARE_' + user.id.slice(0,6) + '_' + Date.now());
  };

  const onPayMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.status === 'success') {
        setBusy(true);
        const nextDate = new Date(); 
        nextDate.setDate(nextDate.getDate() + (isYearly ? 365 : 30));
        
        await supabase.from('care_subscriptions').upsert({
          user_id: user.id, plan: selectedPlan.id, price_ngn: selectedPlan.price_to_pay,
          next_billing_date: nextDate.toISOString().split('T')[0], status: 'active', payment_reference: msg.reference
        }, { onConflict: 'user_id' });

        await supabase.from('meal_plans').upsert({
          user_id: user.id, plan_name: `${selectedPlan.name} Starter Plan`, daily_calories: 1800,
          foods: ['Brown Rice', 'Beans', 'Vegetables', 'Grilled Fish'],
          ai_instructions: `Welcome to ${selectedPlan.name}.`, is_active: true
        });

        setBusy(false); setSelectedPlan(null);
        Alert.alert('Subscribed!', `You are now on ${selectedPlan.name}.`);
        router.replace('/clinical-nutrition');
      } else { setSelectedPlan(null); }
    } catch (e) {}
  };

  const payHtml = payRef && selectedPlan && user?.email ? `
    <html><body style="margin:0;background:#000;">
    <script src="https://js.paystack.co/v1/inline.js"></script>
    <script>
      PaystackPop.setup({
        key: '${PAYSTACK_PUBLIC}', email: '${user.email}',
        amount: ${selectedPlan.price_to_pay * 100}, currency: 'NGN', ref: '${payRef}',
        callback: function(response) { window.ReactNativeWebView.postMessage(JSON.stringify({status:'success', reference: response.reference})); },
        onClose: function() { window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'})); }
      }).openIframe();
    </script></body></html>` : '';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Care Plans</Text>
        <Text style={styles.subtitle}>All plans include unlimited Chat & Voice with Dr. Vinc. The difference is Scan Limits & Family Dashboard.</Text>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, !isYearly && styles.toggleActive]}>Monthly</Text>
          <Switch value={isYearly} onValueChange={setIsYearly} trackColor={{ false: '#cbd5e1', true: '#16a34a' }} />
          <Text style={[styles.toggleText, isYearly && styles.toggleActive]}>Yearly <Text style={{fontSize:10, color:'#d97706'}}>(Save 17%)</Text></Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#bbf7d0' }}>
          <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '700' }}>GAIA Wallet</Text>
          <Text style={{ fontSize: 18, color: '#0f172a', fontWeight: '900' }}>₦{gaiaBalance.toLocaleString()}</Text>
        </View>

        {current ? (
          <View style={styles.currentBox}>
            <Text style={styles.currentTitle}>Active: {current.plan?.toUpperCase() || 'UNKNOWN'}</Text>
            <Text style={styles.currentSub}>Renews: {current.next_billing_date || 'N/A'}</Text>
            <Pressable onPress={() => router.push('/clinical-nutrition')} style={{ marginTop: 12, backgroundColor: '#16a34a', padding: 10, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>GO TO CLINIC</Text>
            </Pressable>
          </View>
        ) : null}

        {plans.map(plan => (
          <View key={plan.id} style={styles.card}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>₦{getPrice(plan).toLocaleString()}<Text style={styles.perMonth}>/{isYearly ? 'yr' : 'mo'}</Text></Text>
            </View>
            <View style={styles.featureList}>
              {(Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]')).map((f: string, i: number) => (
                <Text key={i} style={styles.featureItem}>✅ {f}</Text>
              ))}
            </View>
            <Pressable onPress={() => initiatePayment(plan)} disabled={busy || current?.plan === plan.id} style={[styles.cta, current?.plan === plan.id && { backgroundColor: '#cbd5e1' }]}>
              {busy && selectedPlan?.id === plan.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{current?.plan === plan.id ? 'CURRENT PLAN' : `SUBSCRIBE TO ${plan.name}`}</Text>}
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

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 8, marginBottom: 20, lineHeight: 20 },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 20 },
  toggleText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  toggleActive: { color: '#0f172a' },
  currentBox: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 20 },
  currentTitle: { fontSize: 14, fontWeight: '900', color: '#16a34a' },
  currentSub: { fontSize: 11, color: '#64748b', marginTop: 4 },
  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  planName: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  planPrice: { fontSize: 22, fontWeight: '900', color: '#16a34a' },
  perMonth: { fontSize: 12, color: '#64748b', fontWeight: '400' },
  featureList: { marginBottom: 20 },
  featureItem: { fontSize: 13, color: '#334155', marginBottom: 8, lineHeight: 20 },
  cta: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center' },
  ctaTxt: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
