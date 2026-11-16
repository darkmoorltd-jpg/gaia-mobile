import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const FEE = 10000;

export default function WarehouseListingPay() {
  const router = useRouter();
  const { palette } = useTheme();
  const { unit_id } = useLocalSearchParams<{ unit_id: string }>();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [busy, setBusy] = useState(false);
  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !unit_id) return;
    setLoading(true);
    const { data } = await supabase.from('warehouse_units')
      .select('id, unit_name, unit_type, is_listed, listing_paid_until, warehouse_companies(owner_id, company_name)')
      .eq('id', unit_id).maybeSingle();
    setUnit(data);
    setLoading(false);
  }, [user, unit_id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pay = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('charge-listing-fee', { body: { unit_id } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Init failed');
      const r = await WebBrowser.openAuthSessionAsync(data.authorization_url, 'gaia://warehouse-listing-pay');
      if (r.type === 'success') {
        Alert.alert('Processing', 'Listing activates in a few seconds.');
        setTimeout(load, 5000);
      }
    } catch (e: any) {
      Alert.alert('Payment failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;
  if (!unit) return <View style={styles.center}><Text style={styles.text}>Unit not found</Text></View>;

  const active = unit.is_listed && unit.listing_paid_until && new Date(unit.listing_paid_until) > new Date();
  const expires = unit.listing_paid_until ? new Date(unit.listing_paid_until).toLocaleDateString() : '—';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>List Unit</Text>
        <Text style={styles.sub}>{unit.warehouse_companies?.company_name}</Text>
        <Text style={styles.unitName}>{unit.unit_name} · {unit.unit_type?.toUpperCase()}</Text>

        <View style={styles.card}>
          <Text style={styles.feeLabel}>LISTING FEE</Text>
          <Text style={styles.feeAmount}>₦{FEE.toLocaleString()}</Text>
          <Text style={styles.feeNote}>Per listing, 30-day period.</Text>

          {active ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✅ Listed · expires {expires}</Text>
              <Pressable onPress={() => router.replace('/warehouse-dashboard' as any)} style={styles.cta}>
                <Text style={styles.ctaText}>BACK TO DASHBOARD</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable onPress={pay} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>PAY ₦{FEE.toLocaleString()} — 30 DAYS</Text>}
              </Pressable>
              <Text style={styles.note}>Paystack processes this securely.</Text>
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
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4 },
  unitName: { fontSize: 15, color: p.text, marginTop: 8, fontWeight: '700' },
  card: { backgroundColor: p.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginTop: 20 },
  feeLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2 },
  feeAmount: { fontSize: 44, fontWeight: '900', color: p.text, marginVertical: 12 },
  feeNote: { fontSize: 13, color: p.textMuted, lineHeight: 20, marginBottom: 20 },
  cta: { backgroundColor: p.neon, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
  note: { fontSize: 11, color: p.textMuted, marginTop: 12, textAlign: 'center' },
  successBox: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 16, borderRadius: 12, marginTop: 16 },
  successText: { fontSize: 13, color: p.neon, fontWeight: '800' },
  text: { color: p.text, fontSize: 14 },
});