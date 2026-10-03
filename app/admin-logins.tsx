import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminLogins() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.rpc('admin_list_logins', { p_user_id: null, p_limit: 300 });
    setRows(data || []);
    setBusy(false); setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;

  const filtered = q.trim()
    ? rows.filter((r) => ((r.email || '') + ' ' + (r.platform || '') + ' ' + (r.device_model || '') + ' ' + (r.ip || '')).toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Login History</Text>
        <Text style={s.sub}>{filtered.length} records</Text>

        <TextInput style={s.input} placeholder="Filter by email, device, IP…"
          placeholderTextColor={palette.textDim} value={q} onChangeText={setQ} autoCapitalize="none" />

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {filtered.length === 0 ? (
          <Text style={s.empty}>
            No logins logged yet. The app writes a row on each successful sign-in
            — after the next patch installs, this table fills up automatically.
          </Text>
        ) : (
          filtered.map((r, i) => (
            <View key={i} style={s.card}>
              <Text style={s.cardTitle} numberOfLines={1}>{r.email || r.user_id?.slice(0, 12)}</Text>
              <Text style={s.meta}>{r.platform || '—'} · {r.device_model || '—'}</Text>
              <Text style={s.meta}>IP: {r.ip || '—'}</Text>
              <Text style={s.meta}>{new Date(r.logged_at).toLocaleString()}</Text>
            </View>
          ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 16 },
  card: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  empty: { fontSize: 12, color: p.textMuted, lineHeight: 18, paddingVertical: 20 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
