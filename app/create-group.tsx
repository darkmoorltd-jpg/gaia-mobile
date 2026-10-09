import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface Friend {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  selected: boolean;
}

export default function CreateGroup() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: fships } = await supabase
        .from('friendships').select('sender_id,receiver_id').eq('status', 'accepted');
      const mine = (fships || []).filter((r: any) => r.sender_id === user.id || r.receiver_id === user.id);
      const ids = mine.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id);
      if (ids.length === 0) { setFriends([]); setBusy(false); return; }
      const { data: profiles } = await supabase
        .from('user_profiles').select('user_id,email,first_name,last_name,avatar_url')
        .in('user_id', ids);
      const list: Friend[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        name: ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || (p.email ? p.email.split('@')[0] : 'Farmer'),
        email: p.email || '',
        avatar_url: p.avatar_url || null,
        selected: false,
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setFriends(list);
    } catch (e) { console.log('load friends', e); }
    finally { setBusy(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (uid: string) => {
    setFriends((prev) => prev.map((f) => f.user_id === uid ? { ...f, selected: !f.selected } : f));
  };

  const selectedCount = friends.filter((f) => f.selected).length;
  const canCreate = groupName.trim().length > 0 && selectedCount >= 2;

  const create = async () => {
    if (!canCreate || !user) return;
    setCreating(true);
    try {
      const ids = friends.filter((f) => f.selected).map((f) => f.user_id);
      const { data, error } = await supabase.rpc('create_group', {
        p_name: groupName.trim(),
        p_member_ids: ids,
        p_avatar_url: null,
        p_description: description.trim() || null,
      });
      if (error) throw error;
      const rid = data as unknown as string;
      router.replace(('/chat-room?room=' + rid + '&group=1') as any);
    } catch (e: any) {
      Alert.alert('Create failed', e && e.message ? e.message : 'Try again');
    } finally {
      setCreating(false);
    }
  };

  const filtered = search.trim()
    ? friends.filter((f) => (f.name + ' ' + f.email).toLowerCase().includes(search.toLowerCase()))
    : friends;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps='handled'>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'}</Text>
          </Pressable>
          <Text style={styles.title}>New Group</Text>
          <Pressable onPress={create} disabled={!canCreate || creating} style={[styles.createBtn, (!canCreate || creating) && { opacity: 0.4 }]}>
            {creating ? <ActivityIndicator color='#000' size='small' /> : <Text style={styles.createBtnText}>Create</Text>}
          </Pressable>
        </View>

        <Text style={styles.label}>GROUP NAME</Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder='e.g. Zaria Maize Cooperative'
          placeholderTextColor={palette.textDim}
          style={styles.input}
          maxLength={60}
        />

        <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder='What is this group for?'
          placeholderTextColor={palette.textDim}
          style={[styles.input, { minHeight: 60 }]}
          multiline
          maxLength={200}
        />

        <Text style={styles.label}>ADD MEMBERS ({selectedCount} selected)</Text>
        <Text style={styles.hint}>Pick at least 2 friends.</Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder='Search friends...'
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
          />
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {filtered.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No friends to add.</Text>
            <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>ADD FRIENDS FIRST</Text>
            </Pressable>
          </View>
        ) : null}

        {filtered.map((f) => (
          <Pressable key={f.user_id} onPress={() => toggle(f.user_id)} style={[styles.row, f.selected && styles.rowOn]}>
            <View style={[styles.check, f.selected && styles.checkOn]}>
              {f.selected ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            {f.avatar_url ? (
              <Image source={{ uri: f.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.neonSoft }]}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: palette.neon }}>{f.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={1}>{f.name}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>{f.email}</Text>
            </View>
          </Pressable>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  scroll: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: '#fff', fontWeight: '300', lineHeight: 24 },
  title: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  createBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#00ff88', minWidth: 82, alignItems: 'center' },
  createBtnText: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: '#8696a0', marginTop: 16, marginBottom: 8 },
  hint: { fontSize: 11, color: '#8696a0', marginBottom: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchWrap: { marginTop: 6, marginBottom: 12 },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#8696a0', fontSize: 13 },
  emptyBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#00ff88' },
  emptyBtnText: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 6 },
  rowOn: { backgroundColor: 'rgba(0,255,136,0.08)' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#8696a0', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#00ff88', borderColor: '#00ff88' },
  checkMark: { color: '#000', fontWeight: '900', fontSize: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  rowMeta: { fontSize: 11, color: '#8696a0', marginTop: 2 },
});
