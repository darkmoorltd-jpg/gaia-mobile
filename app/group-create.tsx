import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface Friend {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export default function GroupCreate() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: fships } = await supabase.from('friendships').select('sender_id,receiver_id').eq('status', 'accepted');
      const mine = (fships || []).filter((r: any) => r.sender_id === user.id || r.receiver_id === user.id);
      const ids = mine.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id);
      if (ids.length === 0) { setFriends([]); setBusy(false); return; }
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id,first_name,last_name,email,avatar_url')
        .in('user_id', ids);
      setFriends((profiles || []).map((p: any) => ({
        user_id: p.user_id,
        name: ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || (p.email ? p.email.split('@')[0] : 'Farmer'),
        email: p.email || '',
        avatar_url: p.avatar_url || null,
      })));
    } catch (e) { console.log(e); }
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (uid: string) => setSelected((p) => ({ ...p, [uid]: !p[uid] }));
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const create = async () => {
    if (!user) return;
    if (!groupName.trim()) { Alert.alert('Name required', 'Enter a group name.'); return; }
    if (selectedIds.length < 1) { Alert.alert('Add members', 'Select at least 1 friend.'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_group', {
        p_name: groupName.trim(),
        p_member_ids: selectedIds,
      });
      if (error) throw error;
      const roomId = data?.room_id;
      if (!roomId) throw new Error('no room_id');
      router.replace(('/chat-room?rid=' + roomId) as any);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Try again');
    } finally {
      setCreating(false);
    }
  };

  const visible = friends.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>New Group</Text>
        <Text style={styles.sub}>{selectedIds.length} selected</Text>
        <View style={styles.search}>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder='Group name'
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.search}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder='Search friends'
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
            autoCapitalize='none'
          />
        </View>
      </View>

      {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTxt}>No friends yet</Text></View>}
          renderItem={({ item }) => {
            const on = !!selected[item.user_id];
            return (
              <Pressable onPress={() => toggle(item.user_id)} style={[styles.row, on && styles.rowOn]}>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarTxt}>{item.name.charAt(0).toUpperCase()}</Text></View>}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{item.email}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {selectedIds.length >= 1 && groupName.trim() ? (
        <Pressable onPress={create} disabled={creating} style={styles.createBtn}>
          {creating ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.createTxt}>CREATE GROUP</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: p.border },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  search: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 12, paddingHorizontal: 14, marginBottom: 10 },
  searchInput: { paddingVertical: 11, color: p.text, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 100 },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { fontSize: 14, color: p.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  rowOn: { backgroundColor: 'rgba(0,255,136,0.08)' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: p.neon, borderColor: p.neon },
  checkMark: { color: p.obsidian, fontWeight: '900', fontSize: 13 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 16, fontWeight: '900', color: p.neon },
  rowBody: { flex: 1 },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  createBtn: { position: 'absolute', bottom: 30, left: 20, right: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  createTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.2 },
});
