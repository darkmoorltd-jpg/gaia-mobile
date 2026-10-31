import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function LeaseMarket() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchLeases();
  }, []);

  const fetchLeases = async () => {
    // We fetch retired farmers who want to lease their land
    const { data } = await supabase
      .from('retired_farmers')
      .select('*, user_profiles(first_name, last_name, state, lga)')
      .eq('wants_to_lease', true);
    setLeases(data || []);
    setLoading(false);
  };

  const requestLease = async (retiree: any) => {
    if (!user) return;
    setBusy(true);
    
    // 1. Create a lease record (Assuming GAIA handles the rent calculation, e.g., ₦50k per hectare)
    const rent = retiree.farm_hectares * 50000;
    
    const { error } = await supabase.from('land_leases').insert({
      retiree_id: retiree.user_id,
      tenant_id: user.id,
      hectares: retiree.farm_hectares,
      monthly_rent: rent,
      status: 'pending_payment'
    });

    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert(
        'Lease Request Sent!',
        `You have requested to lease ${retiree.farm_hectares} hectares.\n\nMonthly Rent: ₦${rent.toLocaleString()}.\n\nThe elderly farmer will be notified, and GAIA will process the contract.`
      );
    }
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Lease a Farm</Text>
        <Text style={styles.subtitle}>Get access to land from verified retired farmers.</Text>

        {loading ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {leases.length === 0 && !loading ? (
          <Text style={styles.empty}>No land available for lease right now.</Text>
        ) : null}

        {leases.map(item => {
          const prof = item.user_profiles || {};
          const name = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || 'Retired Farmer';
          
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.farmerName}>{name}</Text>
                <View style={styles.badge}><Text style={styles.badgeTxt}>VERIFIED RETIREE</Text></View>
              </View>
              
              <Text style={styles.location}>📍 {prof.lga}, {prof.state}</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{item.farm_hectares} Ha</Text>
                  <Text style={styles.statLbl}>SIZE</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>₦{Number(item.farm_hectares * 50000).toLocaleString()}</Text>
                  <Text style={styles.statLbl}>RENT / MO</Text>
                </View>
              </View>

              <Pressable onPress={() => requestLease(item)} disabled={busy} style={styles.btn}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>REQUEST LEASE</Text>}
              </Pressable>
            </View>
          );
        })}
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
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  farmerName: { fontSize: 16, fontWeight: '900', color: p.text },
  badge: { backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#ffd700' },
  badgeTxt: { fontSize: 8, fontWeight: '900', color: '#ffd700', letterSpacing: 0.5 },
  location: { fontSize: 12, color: p.textMuted, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: p.obsidian, padding: 12, borderRadius: 8, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 4 },
  btn: { backgroundColor: p.neon, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
