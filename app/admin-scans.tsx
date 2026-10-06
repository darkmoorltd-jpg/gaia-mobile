import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useRouter, useLocalSearch,Params } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const TYPES = ['all', 'crop', 'pest', 'soil', 'livestock', 'video', 'image-qa'];

export default function AdminScans() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id?: string }>();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_list_scans', {
      p_user_id: params.user_id || null,
      p_scan_type: type,
      p_limit: 200,
    });
    if (!error) setRows(data || []);
    setBusy(false); setRef(false);
  }, [isAdmin, type, params.user_id]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;

  const filtered = q.trim()
    ? rows.filter((r) => ((r.user_email || '') + ' ' + (r.top_label || '') + ' ' + (r.crop || '')).toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Scan Feed</Text>
        <Text style={s.sub}>{filtered.length} scans{params.user_id ? ' (filtered user)' : ''}</Text>

        <View style={s.chipRow}>
          {TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[s.chip, type === t && s.chipOn]}>
              <Text style={[s.chipText, type === t && s.chipTextOn]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput style={s.input} placeholder="Filter by email or diagnosis…"
          placeholderTextColor={palette.textDim} value={q} onChangeText={setQ} autoCapitalize="none" />

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {filtered.length === 0 ? <Text style={s.empty}>No scans yet.</Text> :
          filtered.map((r) => (
            <View key={r.id} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle} numberOfLines={1}>{r.top_label}</Text>
                <Text style={s.conf}>{Number(r.confidence || 0).toFixed(1)}%</Text>
              </View>
              <Text style={s.meta}>{(r.scan_type || '').toUpperCase()}{r.crop ? ' · ' + r.crop : ''}{r.animal ? ' · ' + r.animal : ''}</Text>
              <Text style={s.meta}>{r.user_email}</Text>
              <Text style={s.meta}>{new Date(r.created_at).toLocaleString()} · {r.model_key || '—'}{r.processing_ms ? ' · ' + r.processing_ms + 'ms' : ''}</Text>

              {r.image_url ? (
                <Pressable onPress={() => Linking.openURL(r.image_url)} style={{ marginTop: 10 }}>
                  <Image source={{ uri: r.image_url }} style={s.img} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={[s.img, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={s.meta}>no image</Text>
                </View>
              )}

              {Array.isArray(r.all_predictions) && r.all_predictions.length > 1 ? (
                <View style={{ marginTop: 8 }}>
                  {r.all_predictions.slice(0, 4).map((p: any, i: number) => (
                    <Text key={i} style={s.meta}>{p.label}: {Number(p.confidence || 0).toFixed(1)}%</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))}

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
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '700', color: p.textDim, letterSpacing: 0.5 },
  chipTextOn: { color: p.neon },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 12 },
  card: { padding: 12, borderRadius: 12, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  conf: { fontSize: 14, fontWeight: '900', color: p.neon },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  img: { width: '100%', height: 200, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.15)', marginTop: 8 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 40 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
