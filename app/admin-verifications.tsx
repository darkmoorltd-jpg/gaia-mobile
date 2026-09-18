import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminVerifications() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('farmer_verifications').select('*').order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
  };

  useEffect(() => { if (user?.email?.toLowerCase() === ADMIN_EMAIL) load(); }, [user]);

  const setStatus = async (id: string, status: string) => {
    await supabase.from('farmer_verifications').update({ status }).eq('id', id);
    load();
  };

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Verifications</Text>
        <Text style={styles.sub}>{rows.length} submissions</Text>
        {rows.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.name}>{r.full_name || 'Unknown'}</Text>
            <Text style={styles.detail}>{r.state} · {r.phone}</Text>
            <Text style={[styles.status, r.status === 'approved' && { color: palette.neon }]}>{r.status || 'pending'}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => setStatus(r.id, 'approved')} style={styles.approve}>
                <Text style={styles.approveText}>APPROVE</Text>
              </Pressable>
              <Pressable onPress={() => setStatus(r.id, 'rejected')} style={styles.reject}>
                <Text style={styles.rejectText}>REJECT</Text>
              </Pressable>
            </View>
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
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  detail: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  status: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.warning, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approve: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: p.neon, alignItems: 'center' },
  approveText: { fontSize: 12, fontWeight: '900', color: p.obsidian },
  reject: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.danger, alignItems: 'center' },
  rejectText: { fontSize: 12, fontWeight: '900', color: p.danger },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
