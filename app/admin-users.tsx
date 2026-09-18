import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminUsers() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return;
      const { data } = await supabase.from('user_scans').select('*').limit(100);
      setRows(data || []);
    })();
  }, [user]);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.sub}>{rows.length} records</Text>
        {rows.map((r, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.rowLabel}>{r.user_id?.slice(0, 12)}...</Text>
            <Text style={styles.rowValue}>Scans: {r.scans_remaining} · Plan: {r.plan}</Text>
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
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  rowLabel: { fontSize: 13, fontWeight: '700', color: p.text },
  rowValue: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
