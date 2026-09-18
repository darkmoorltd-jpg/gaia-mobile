import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminPayments() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      if (user?.email?.toLowerCase() !== ADMIN_EMAIL) return;
      const { data } = await supabase.from('payment_history').select('*').order('paid_at', { ascending: false }).limit(100);
      setRows(data || []);
      const sum = (data || []).reduce((a: number, b: any) => a + (b.amount || 0), 0);
      setTotal(sum);
    })();
  }, [user]);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.big}>N{(total / 100).toLocaleString()}</Text>
        <Text style={styles.sub}>{rows.length} transactions</Text>
        {rows.map((r, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.amount}>N{(r.amount / 100).toFixed(2)}</Text>
              <Text style={styles.plan}>{r.plan?.toUpperCase()}</Text>
            </View>
            <Text style={styles.ref}>#{r.reference?.slice(0, 18)}</Text>
            <Text style={styles.date}>{new Date(r.paid_at).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  big: { fontSize: 40, fontWeight: '900', color: p.neon, marginTop: 8 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 18, fontWeight: '900', color: p.text },
  plan: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  ref: { fontSize: 11, color: p.textDim, marginTop: 6, fontFamily: 'monospace' },
  date: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
