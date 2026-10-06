import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminSupport() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<'open' | 'closed' | 'all'>('open');
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [act, setAct] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_list_tickets', { p_status: tab });
    if (!error) setRows(data || []);
    setBusy(false); setRef(false);
  }, [isAdmin, tab]);

  useEffect(() => { load(); }, [load]);

  const reply = async (ticketId: string) => {
    const msg = (draft[ticketId] || '').trim();
    if (!msg) return;
    setAct(true);
    const { error } = await supabase.rpc('admin_reply_support', { p_ticket_id: ticketId, p_reply: msg });
    setAct(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setDraft((d) => ({ ...d, [ticketId]: '' }));
    Alert.alert('Sent');
  };

  const close = async (ticketId: string) => {
    setAct(true);
    const { error } = await supabase.rpc('admin_close_support', { p_ticket_id: ticketId });
    setAct(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    load();
  };

  if (!isAdmin) return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;

  const filtered = q.trim()
    ? rows.filter((r) => ((r.user_email || '') + ' ' + (r.subject || '') + ' ' + (r.message || '')).toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Support Inbox</Text>
        <Text style={s.sub}>{filtered.length} tickets</Text>

        <View style={s.tabBar}>
          {(['open','closed','all'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab===t && s.tabBtnActive]}>
              <Text style={[s.tabText, tab===t && s.tabTextActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput style={s.input} placeholder="Filter by email or subject…"
          placeholderTextColor={palette.textDim} value={q} onChangeText={setQ} autoCapitalize="none" />

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {filtered.length === 0 ? <Text style={s.empty}>No tickets.</Text> :
          filtered.map((t) => (
            <View key={t.id} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={s.cardTitle} numberOfLines={1}>{t.subject || '(no subject)'}</Text>
                <Text style={s.chip}>{(t.status || '').toUpperCase()}</Text>
              </View>
              <Text style={s.meta}>{t.user_email}</Text>
              <Text style={s.meta}>{new Date(t.created_at).toLocaleString()} · {t.reply_count || 0} replies</Text>
              <Text style={s.body}>{t.message}</Text>
              {t.attachment_url ? (
                <Pressable onPress={() => Linking.openURL(t.attachment_url)}>
                  <Text style={s.link}>Open attachment</Text>
                </Pressable>
              ) : null}

              <TextInput style={[s.input, { marginTop: 10, minHeight: 60 }]}
                placeholder="Write a reply…" placeholderTextColor={palette.textDim}
                value={draft[t.id] || ''} onChangeText={(v) => setDraft((d) => ({ ...d, [t.id]: v }))}
                multiline />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable disabled={act} onPress={() => reply(t.id)} style={[s.small, { borderColor: palette.neon }]}>
                  <Text style={[s.smallText, { color: palette.neon }]}>SEND REPLY</Text>
                </Pressable>
                {t.status !== 'closed' ? (
                  <Pressable disabled={act} onPress={() => close(t.id)} style={[s.small, { borderColor: palette.warning }]}>
                    <Text style={[s.smallText, { color: palette.warning }]}>CLOSE</Text>
                  </Pressable>
                ) : null}
              </View>
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
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 12, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 12 },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 14, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  chip: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 1, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  body: { fontSize: 12, color: p.text, marginTop: 8, lineHeight: 18 },
  link: { fontSize: 11, fontWeight: '800', color: p.neon, marginTop: 8 },
  small: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  smallText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 40 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
