import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminTools() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<'bulk' | 'push'>('bulk');

  // bulk state
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkQ, setBulkQ] = useState('');
  const [busy, setBusy] = useState(true);
  const [act, setAct] = useState(false);

  // push state
  const [pushTitle, setPushTitle] = useState('Test from admin');
  const [pushBody, setPushBody] = useState('This is a test notification.');

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.rpc('admin_list_users');
    setUsers(data || []);
    setBusy(false);
  }, [isAdmin]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const toggle = (uid: string) => setSelected((prev) => ({ ...prev, [uid]: !prev[uid] }));

  const selectAll = () => {
    const map: Record<string, boolean> = {};
    filtered.forEach((u) => { map[u.user_id] = true; });
    setSelected(map);
  };

  const clearAll = () => setSelected({});

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const applyBulk = (delta: number) => {
    if (selectedIds.length === 0) { Alert.alert('Select at least one user'); return; }
    Alert.alert(
      (delta > 0 ? 'Add ' : 'Remove ') + Math.abs(delta) + ' scans to ' + selectedIds.length + ' user(s)?',
      '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setAct(true);
        const { data, error } = await supabase.rpc('admin_bulk_add_scans', { p_user_ids: selectedIds, p_delta: delta });
        setAct(false);
        if (error) Alert.alert('Failed', error.message);
        else { Alert.alert('Done', data + ' users updated'); clearAll(); loadUsers(); }
      }},
    ]);
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) { Alert.alert('Title and body required'); return; }
    setAct(true);
    const { error } = await supabase.rpc('admin_broadcast', {
      p_title: pushTitle.trim(), p_body: pushBody.trim(), p_segment: 'user:' + user?.id,
    });
    setAct(false);
    if (error) Alert.alert('Failed', error.message);
    else Alert.alert('Queued', 'Notification queued for you. Delivery requires a backend worker.');
  };

  if (!isAdmin) return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;

  const filtered = bulkQ.trim()
    ? users.filter((u) => ((u.email || '') + ' ' + (u.first_name || '') + ' ' + (u.last_name || '')).toLowerCase().includes(bulkQ.toLowerCase()))
    : users;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Tools</Text>
        <Text style={s.sub}>Bulk actions and push testing</Text>

        <View style={s.tabBar}>
          <Pressable onPress={() => setTab('bulk')} style={[s.tabBtn, tab==='bulk' && s.tabBtnActive]}>
            <Text style={[s.tabText, tab==='bulk' && s.tabTextActive]}>Bulk Actions</Text>
          </Pressable>
          <Pressable onPress={() => setTab('push')} style={[s.tabBtn, tab==='push' && s.tabBtnActive]}>
            <Text style={[s.tabText, tab==='push' && s.tabTextActive]}>Push Test</Text>
          </Pressable>
        </View>

        {tab === 'bulk' ? (
          <>
            <TextInput style={s.input} placeholder="Filter users…" placeholderTextColor={palette.textDim} value={bulkQ} onChangeText={setBulkQ} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Pressable onPress={selectAll} style={[s.small, { borderColor: palette.borderHi, flex: 1 }]}>
                <Text style={[s.smallText, { color: palette.text }]}>SELECT ALL ({filtered.length})</Text>
              </Pressable>
              <Pressable onPress={clearAll} style={[s.small, { borderColor: palette.borderHi, flex: 1 }]}>
                <Text style={[s.smallText, { color: palette.text }]}>CLEAR</Text>
              </Pressable>
            </View>

            <Text style={s.meta}>{selectedIds.length} selected</Text>

            {busy ? <ActivityIndicator color={palette.neon} /> : null}

            {filtered.slice(0, 200).map((u) => (
              <Pressable key={u.user_id} onPress={() => toggle(u.user_id)} style={[s.card, selected[u.user_id] && { borderColor: palette.neon }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.check, selected[u.user_id] && s.checkOn]}>
                    {selected[u.user_id] ? <Text style={s.checkMark}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle} numberOfLines={1}>{u.email}</Text>
                    <Text style={s.meta}>{u.scans_remaining} scans · {(u.plan || 'free').toUpperCase()}</Text>
                  </View>
                </View>
              </Pressable>
            ))}

            <Text style={s.label}>APPLY TO SELECTION</Text>
            <Pressable disabled={act} onPress={() => applyBulk(50)} style={s.btn}>
              <Text style={s.btnText}>+50 SCANS EACH</Text>
            </Pressable>
            <Pressable disabled={act} onPress={() => applyBulk(500)} style={s.btn}>
              <Text style={s.btnText}>+500 SCANS EACH</Text>
            </Pressable>
            <Pressable disabled={act} onPress={() => applyBulk(-50)} style={[s.btn, { backgroundColor: palette.warning }]}>
              <Text style={[s.btnText, { color: palette.obsidian }]}>-50 SCANS EACH</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.label}>TITLE</Text>
            <TextInput style={s.input} value={pushTitle} onChangeText={setPushTitle} placeholderTextColor={palette.textDim} />
            <Text style={s.label}>BODY</Text>
            <TextInput style={[s.input, { minHeight: 100 }]} value={pushBody} onChangeText={setPushBody} multiline placeholderTextColor={palette.textDim} />
            <Pressable disabled={act} onPress={sendPush} style={s.btn}>
              <Text style={s.btnText}>SEND TEST PUSH TO ME</Text>
            </Pressable>
            <Text style={s.hint}>
              Queues a row in notification_queue for your account. Actual push delivery requires a
              backend worker (Render cron or Supabase edge function) that reads the queue and calls
              the Expo push API. That's a separate build.
            </Text>
          </>
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
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  card: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 6, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 12, fontWeight: '700', color: p.text },
  meta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: p.neon, borderColor: p.neon },
  checkMark: { color: p.obsidian, fontWeight: '900', fontSize: 12 },
  small: { paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  smallText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  btn: { paddingVertical: 14, borderRadius: 10, backgroundColor: p.neon, alignItems: 'center', marginBottom: 8 },
  btnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  hint: { fontSize: 11, color: p.textMuted, lineHeight: 16, fontStyle: 'italic', marginTop: 12 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
