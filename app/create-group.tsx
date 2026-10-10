import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
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
}

export default function CreateGroup() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: fships } = await supabase
        .from('friendships')
        .select('sender_id,receiver_id')
        .eq('status', 'accepted');
      const mine = (fships || []).filter((r: any) => r.sender_id === user.id || r.receiver_id === user.id);
      const ids = mine.map((r: any) => (r.sender_id === user.id ? r.receiver_id : r.sender_id));
      if (ids.length === 0) { setFriends([]); setBusy(false); return; }
      const { data: profs } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name,avatar_url')
        .in('user_id', ids);
      const list: Friend[] = (profs || []).map((p: any) => {
        const n = ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
        return {
          user_id: p.user_id,
          name: n || (p.email ? p.email.split('@')[0] : 'Farmer'),
          email: p.email || '',
          avatar_url: p.avatar_url || null,
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setFriends(list);
    } catch (e) { console.log('create-group load', e); }
    finally { setBusy(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const create = async () => {
    if (!groupName.trim()) { Alert.alert('Name required', 'Enter a group name.'); return; }
    if (selected.size < 1) { Alert.alert('Pick members', 'Select at least one friend.'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('get_or_create_group', {
        p_name: groupName.trim(),
        p_member_ids: Array.from(selected),
      });
      if (error) throw error;
      const roomId = data as unknown as string;
      setGroupName('');
      setSelected(new Set());
      router.replace(('/chat-room?room=' + roomId + '&group=1') as any);
    } catch (e: any) {
      Alert.alert('Failed', e && e.message ? e.message : 'Try again');
    } finally { setCreating(false); }
  };

  const filtered = search.trim()
    ? friends.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.email.toLowerCase().includes(search.toLowerCase()))
    : friends;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>New Group</Text>
        <Pressable
          onPress={create}
          disabled={creating || !groupName.trim() || selected.size < 1}
          style={[styles.createBtn, (creating || !groupName.trim() || selected.size < 1) && { opacity: 0.4 }]}
        >
          {creating
            ? <ActivityIndicator color={palette.obsidian} size="small" />
            : <Text style={styles.createBtnText}>CREATE</Text>}
        </Pressable>
      </View>

      <View style={styles.nameBox}>
        <Text style={styles.nameLabel}>GROUP NAME</Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="e.g. Zaria Maize Farmers"
          placeholderTextColor={palette.textDim}
          style={styles.nameInput}
          maxLength={60}
        />
        <Text style={styles.counter}>{groupName.length}/60</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search friends"
          placeholderTextColor={palette.textDim}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.selectedRow}>
        <Text style={styles.selectedLabel}>
          {selected.size === 0 ? 'Select members' : selected.size + ' selected'}
        </Text>
      </View>

      {busy ? (
        <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>
      ) : friends.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySub}>Add friends first to create a group.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const on = selected.has(item.user_id);
            return (
              <Pressable
                onPress={() => toggle(item.user_id)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }, on && styles.rowOn]}
              >
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on ? <Text style={styles.checkmark}>Y</Text> : null}
                </View>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  backText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  title: { flex: 1, fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  createBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
    backgroundColor: p.neon, minWidth: 84, alignItems: 'center',
  },
  createBtnText: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  nameBox: { paddingHorizontal: 20, marginBottom: 12 },
  nameLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  nameInput: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    color: p.text, fontSize: 15,
  },
  counter: { fontSize: 10, color: p.textDim, textAlign: 'right', marginTop: 4 },
  searchWrap: { paddingHorizontal: 20, marginBottom: 8 },
  searchInput: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    color: p.text, fontSize: 14,
  },
  selectedRow: { paddingHorizontal: 20, paddingVertical: 6 },
  selectedLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: p.neon },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: p.textMuted },
  emptySub: { fontSize: 12, color: p.textDim, marginTop: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
  },
  rowOn: { backgroundColor: 'rgba(0,255,136,0.08)' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: p.neon, borderColor: p.neon },
  checkmark: { fontSize: 12, fontWeight: '900', color: p.obsidian },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: p.neon },
  name: { fontSize: 15, fontWeight: '700', color: p.text },
  email: { fontSize: 12, color: p.textMuted, marginTop: 2 },
});
