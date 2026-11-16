import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const FEE = 20000;

export default function WarehousePayFee() {
  const router = useRouter();
  const { palette } = useTheme();
  const { company_id } = useLocalSearchParams<{ company_id: string }>();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !company_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('warehouse_companies')
      .select('id, company_name, verification_status, registration_fee_paid_at')
      .eq('id', company_id)
      .maybeSingle();
    setCompany(data);
    setLoading(false);
  }, [user, company_id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const payNow = async () => {
    setBusy(true);
    try {
      // Uses Supabase client's built-in function invoke — auth is automatic
      const { data, error } = await supabase.functions.invoke('charge-registration-fee', {
        body: { company_id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Payment init failed');

      const result = await WebBrowser.openAuthSessionAsync(
        data.authorization_url,
        'gaia://warehouse-pay-fee',
      );

      if (result.type === 'success') {
        Alert.alert(
          'Payment processing',
          'Activation usually completes in 5-15 seconds. If the screen still shows "Pay", close and reopen this page.',
        );
        // Poll once after 5s
        setTimeout(load, 5000);
      }
    } catch (e: any) {
      Alert.alert('Payment failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;
  }

  if (!company) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Company not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: palette.textMuted }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const paid = !!company.registration_fee_paid_at;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Activate Warehouse</Text>
        <Text style={styles.sub}>{company.company_name}</Text>

        <View style={styles.card}>
          <Text style={styles.feeLabel}>REGISTRATION FEE</Text>
          <Text style={styles.feeAmount}>₦{FEE.toLocaleString()}</Text>
          <Text style={styles.feeNote}>
            One-time. Activates your account and lets you list storage units.
            First listing is free for 30 days.
          </Text>

          {paid ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                ✅ Paid on {new Date(company.registration_fee_paid_at).toLocaleDateString()}
              </Text>
              <Pressable
                onPress={() => router.replace('/warehouse-dashboard' as any)}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>GO TO DASHBOARD</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable
                onPress={payNow}
                disabled={busy}
                style={[styles.cta, busy && { opacity: 0.6 }]}
              >
                {busy
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.ctaText}>PAY ₦{FEE.toLocaleString()} NOW</Text>}
              </Pressable>
              <Text style={styles.note}>
                Payment is processed securely by Paystack. If you were charged but activation didn't
                complete, reopen this screen in 60 seconds.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  text: { fontSize: 14, color: p.text },
  card: { backgroundColor: p.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginTop: 20 },
  feeLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2 },
  feeAmount: { fontSize: 48, fontWeight: '900', color: p.text, marginVertical: 12 },
  feeNote: { fontSize: 13, color: p.textMuted, lineHeight: 20, marginBottom: 20 },
  cta: { backgroundColor: p.neon, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
  note: { fontSize: 11, color: p.textMuted, marginTop: 16, lineHeight: 16, textAlign: 'center' },
  successBox: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 16, borderRadius: 12, marginTop: 16 },
  successText: { fontSize: 13, color: p.neon, fontWeight: '800' },
});
