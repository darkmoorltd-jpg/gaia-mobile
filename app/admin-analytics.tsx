import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminAnalytics() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [users, setUsers] = useState(0);
  const [scans, setScans] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [verifs, setVerifs] = useState(0);

  useEffect(() => {
    (async () => {
      if (user?.email?.toLowerCase() !== ADMIN_EMAIL) return;
      const { data: us } = await supabase.from('user_scans').select('scans_remaining');
      const { data: ph } = await supabase.from('payment_history').select('amount');
      const { data: vf } = await supabase.from('farmer_verifications').select('id');
      setUsers((us || []).length);
      setScans((us || []).reduce((a: number, b: any) => a + (b.scans_remaining || 0), 0));
      setRevenue((ph || []).reduce((a: number, b: any) => a + (b.amount || 0), 0) / 100);
      setVerifs((vf || []).length);
    })();
  }, [user]);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.sub}>Live platform metrics</Text>

        <View style={styles.grid}>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{users}</Text>
            <Text style={styles.metricLbl}>USERS</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{scans}</Text>
            <Text style={styles.metricLbl}>SCANS LEFT</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>N{revenue.toLocaleString()}</Text>
            <Text style={styles.metricLbl}>REVENUE</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{verifs}</Text>
            <Text style={styles.metricLbl}>VERIFICATIONS</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', padding: 20, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  metricVal: { fontSize: 26, fontWeight: '900', color: p.neon },
  metricLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginTop: 6 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
