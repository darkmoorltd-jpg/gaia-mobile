import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function DriverEarnings() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [trips, setTrips] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    
    const [tripRes, expRes, profRes] = await Promise.all([
      supabase.from('batch_movements').select('*, batches(batch_code, crop_name)').eq('driver_id', user.id).in('status', ['delivered', 'received']).order('arrived_at', { ascending: false }),
      supabase.from('trip_expenses').select('*').eq('driver_id', user.id),
      supabase.from('driver_profiles').select('average_rating, total_ratings, completed_trips').eq('user_id', user.id).single()
    ]);

    if (tripRes.data) setTrips(tripRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (profRes.data) setProfile(profRes.data);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalGross = trips.reduce((sum, t) => sum + Number(t.delivery_fee || 0), 0);
  const totalCommission = trips.reduce((sum, t) => sum + Number(t.gaia_commission || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount_naira || 0), 0);
  const totalNet = totalGross - totalCommission - totalExpenses;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Wallet</Text>

        {profile ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <View style={{ flex: 1, padding: 12, backgroundColor: '#222', borderRadius: 10 }}>
              <Text style={{ fontSize: 10, color: '#888', fontWeight: '800' }}>RATING</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#ffd700', marginTop: 4 }}>⭐ {profile.average_rating || 5.0}</Text>
            </View>
            <View style={{ flex: 1, padding: 12, backgroundColor: '#222', borderRadius: 10 }}>
              <Text style={{ fontSize: 10, color: '#888', fontWeight: '800' }}>TRIPS</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', marginTop: 4 }}>{profile.completed_trips || 0}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>NET EARNINGS</Text>
          <Text style={styles.walletBal}>₦{totalNet.toLocaleString()}</Text>
          <Text style={styles.walletSub}>Gross: ₦{totalGross.toLocaleString()} · Commission: -₦{totalCommission.toLocaleString()} · Expenses: -₦{totalExpenses.toLocaleString()}</Text>
          
          <Pressable style={styles.withdrawBtn} onPress={() => alert('Withdrawal feature coming soon via Paystack.')}>
            <Text style={styles.withdrawTxt}>WITHDRAW TO BANK</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>COMPLETED TRIPS</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {trips.length === 0 && !busy ? <Text style={styles.empty}>No completed trips yet.</Text> : null}

        {trips.map((t) => {
          const tripExp = expenses.filter(e => e.movement_id === t.id).reduce((s, e) => s + Number(e.amount_naira), 0);
          const net = Number(t.delivery_fee || 0) - Number(t.gaia_commission || 0) - tripExp;
          return (
            <View key={t.id} style={styles.tripCard}>
              <View style={styles.row}>
                <Text style={styles.batchCode}>{t.batches?.batch_code}</Text>
                <Text style={styles.amount}>+₦{net.toLocaleString()}</Text>
              </View>
              <Text style={styles.meta}>{t.batches?.crop_name}</Text>
              <Text style={styles.meta}>{t.arrived_at ? new Date(t.arrived_at).toLocaleDateString() : 'N/A'}</Text>
              {tripExp > 0 ? <Text style={styles.loss}>Expenses: ₦{tripExp.toLocaleString()}</Text> : null}
              {t.loss_kg > 0 ? <Text style={styles.loss}>Cargo Loss: {t.loss_kg}kg</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, marginBottom: 20 },
  walletCard: { backgroundColor: p.neonSoft, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: p.neon, marginBottom: 24 },
  walletLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  walletBal: { fontSize: 36, fontWeight: '900', color: p.text, marginVertical: 8 },
  walletSub: { fontSize: 11, color: p.textMuted, marginBottom: 16, lineHeight: 16 },
  withdrawBtn: { backgroundColor: p.neon, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  withdrawTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  empty: { color: p.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  tripCard: { backgroundColor: p.surface, padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  batchCode: { fontSize: 14, fontWeight: '800', color: p.text, fontFamily: 'monospace' },
  amount: { fontSize: 14, fontWeight: '900', color: p.neon },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  loss: { fontSize: 11, color: '#ff3b5c', marginTop: 6, fontWeight: '700' },
});
