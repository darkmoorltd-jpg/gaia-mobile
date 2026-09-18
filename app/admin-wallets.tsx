import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminWallets() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      if (user?.email?.toLowerCase() !== ADMIN_EMAIL) return;
      try {
        const { data } = await supabase.from('farmer_wallets').select('*').limit(200);
        setRows(data || []);
      } catch {}
      setBusy(false);
    })();
  }, [user]);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>Access denied</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Wallets</Text>
        <Text style={styles.sub}>{rows.length} records</Text>
        {busy ? <Text style={styles.loading}>Loading...</Text> : null}
        {!busy && rows.length === 0 ? (
          <Text style={styles.loading}>No records yet.</Text>
        ) : null}
        {rows.map((r, i) => (
          <View key={i} style={styles.card}>
            {Object.entries(r).slice(0, 6).map(([k, v]) => (
              <Text key={k} style={styles.kv}>
                <Text style={styles.k}>{k}: </Text>
                {String(v)}
              </Text>
            ))}
          </View>
        ))}
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
  loading: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  kv: { fontSize: 12, color: p.text, marginBottom: 4 },
  k: { color: p.neon, fontWeight: '700' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
