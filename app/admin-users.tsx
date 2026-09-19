import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
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
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return;
      setBusy(true);
      try {
        const { data: scans } = await supabase
          .from('user_scans')
          .select('user_id, scans_remaining, plan')
          .limit(500);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, email, first_name, last_name, state, phone')
          .limit(500);
        const pMap: Record<string, any> = {};
        (profiles || []).forEach((p) => { pMap[p.user_id] = p; });
        const merged = (scans || []).map((s) => ({
          ...s,
          profile: pMap[s.user_id] || {},
        }));
        setRows(merged);
      } catch {}
      setBusy(false);
    })();
  }, [user]);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const filtered = search.trim()
    ? rows.filter((r) => {
        const p = r.profile || {};
        const hay = ((p.email || '') + ' ' + (p.first_name || '') + ' ' + (p.last_name || '') + ' ' + (p.state || '')).toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : rows;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>All Users</Text>
        <Text style={styles.sub}>{rows.length} registered farmers</Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by email, name, state…"
            placeholderTextColor={palette.textDim}
            style={styles.search}
          />
        </View>

        {busy ? <Text style={styles.loading}>Loading…</Text> : null}

        {filtered.map((r, i) => {
          const p = r.profile || {};
          const name = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || 'Farmer';
          const initial = (name[0] || 'F').toUpperCase();
          return (
            <View key={i} style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.email} numberOfLines={1}>{p.email || r.user_id.slice(0, 16) + '…'}</Text>
                <View style={styles.metaRow}>
                  {p.state ? <Text style={styles.meta}>📍 {p.state}</Text> : null}
                  <Text style={styles.meta}>📉 {r.scans_remaining} scans</Text>
                  <Text style={[styles.planTag, { backgroundColor: r.plan === 'free' ? palette.surfaceHi : palette.neonSoft }]}>
                    {r.plan?.toUpperCase() || 'FREE'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {filtered.length === 0 && !busy ? <Text style={styles.loading}>No users found.</Text> : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  searchWrap: { marginBottom: 16 },
  search: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: p.text, fontSize: 14 },
  loading: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900', color: p.neon },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  email: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6 },
  meta: { fontSize: 11, color: p.textMuted },
  planTag: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: p.neon, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
