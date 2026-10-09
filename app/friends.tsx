import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, RefreshControl, Image, Alert, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { listBlockedUsers, unblockUser } from '../src/utils/friends';

interface Friend {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  state: string | null;
  online: boolean;
  last_seen: string | null;
}

type Tab = 'all' | 'online' | 'blocked';

export default function Friends() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      // 1. Accepted friendships
      const { data: fships } = await supabase
        .from('friendships')
        .select('sender_id,receiver_id')
        .eq('status', 'accepted');
      const mine = (fships || []).filter((r: any) => r.sender_id === user.id || r.receiver_id === user.id);
      const ids = mine.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id);

      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id,first_name,last_name,email,avatar_url,state')
          .in('user_id', ids);
        const { data: presences } = await supabase
          .from('user_presence')
          .select('user_id,last_seen')
          .in('user_id', ids);
        const presenceMap: Record<string, string> = {};
        (presences || []).forEach((p: any) => { presenceMap[p.user_id] = p.last_seen; });
        const list: Friend[] = (profiles || []).map((p: any) => ({
          user_id: p.user_id,
          name: ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || (p.email ? p.email.split('@')[0] : 'Farmer'),
          email: p.email || '',
          avatar_url: p.avatar_url || null,
          state: p.state || null,
          online: presenceMap[p.user_id] ? Date.now() - new Date(presenceMap[p.user_id]).getTime() < 120000 : false,
          last_seen: presenceMap[p.user_id] || null,
        }));
        list.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || a.name.localeCompare(b.name));
        setFriends(list);
      } else {
        setFriends([]);
      }

      // 2. Blocked users
      const blockedList = await listBlockedUsers(user.id);
      setBlocked(blockedList || []);
    } catch (e) { console.log('friends load', e); }
    setBusy(false);
    setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeFriend = (f: Friend) => {
    Alert.alert('Remove ' + f.name + '?', 'You will no longer be friends. Chats will be hidden.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        if (!user) return;
        try {
          await supabase.from('friendships')
            .delete()
            .or('and(sender_id.eq.' + user.id + ',receiver_id.eq.' + f.user_id + '),and(sender_id.eq.' + f.user_id + ',receiver_id.eq.' + user.id + ')');
          setFriends((prev) => prev.filter((x) => x.user_id !== f.user_id));
        } catch (e) { Alert.alert('Failed', 'Try again'); }
      }},
    ]);
  };

  const confirmUnblock = (row: any) => {
    Alert.alert('Unblock?', 'They will be able to message you again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: async () => {
        if (!user) return;
        await unblockUser(user.id, row.blocked_id);
        setBlocked((prev) => prev.filter((x) => x.blocked_id !== row.blocked_id));
      }},
    ]);
  };

  const onRowPress = (f: Friend) => router.push(('/chat-room?uid=' + f.user_id) as any);
  const onRowLong = (f: Friend) => {
    Alert.alert(f.name, 'Friend options', [
      { text: 'Message', onPress: () => onRowPress(f) },
      { text: 'Call', onPress: () => Alert.alert('Call', 'Voice calls coming soon.') },
      { text: 'Remove friend', style: 'destructive', onPress: () => removeFriend(f) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const visible = friends.filter((f) => {
    if (tab === 'online' && !f.online) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
  });

  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/friend-requests' as any)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>R</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.iconBtnSolid}>
              <Text style={styles.iconBtnSolidText}>+</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.sub}>{friends.length} total · {onlineCount} online</Text>

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

        <View style={styles.tabs}>
          {(['all', 'online', 'blocked'] as Tab[]).map((t) => {
            const label = t === 'all' ? 'All (' + friends.length + ')' : t === 'online' ? 'Online (' + onlineCount + ')' : 'Blocked (' + blocked.length + ')';
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'blocked' ? (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.blocked_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTxt}>No blocked users</Text></View>}
          renderItem={({ item }) => {
            const p = item.profile || {};
            const name = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.email || 'User';
            return (
              <View style={styles.row}>
                {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarTxt}>{name.charAt(0).toUpperCase()}</Text></View>}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{p.email || ''}</Text>
                </View>
                <Pressable onPress={() => confirmUnblock(item)} style={styles.unblockBtn}>
                  <Text style={styles.unblockTxt}>Unblock</Text>
                </Pressable>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>{tab === 'online' ? 'No friends online right now' : search ? 'No matches' : 'No friends yet'}</Text>
              <Text style={styles.emptySub}>{!search && tab === 'all' ? 'Add a friend to start chatting.' : ''}</Text>
              {!search && tab === 'all' ? (
                <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnTxt}>ADD A FRIEND</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onRowPress(item)}
              onLongPress={() => onRowLong(item)}
              delayLongPress={350}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.avatarWrap}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}><Text style={styles.avatarTxt}>{item.name.charAt(0).toUpperCase()}</Text></View>
                )}
                {item.online ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{item.online ? 'Online' : item.state || item.email}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: p.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 14, fontWeight: '900', color: p.neon },
  iconBtnSolid: { width: 42, height: 42, borderRadius: 21, backgroundColor: p.neon, alignItems: 'center', justifyContent: 'center' },
  iconBtnSolidText: { fontSize: 22, fontWeight: '900', color: p.obsidian, lineHeight: 24 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  search: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 12, paddingHorizontal: 14, marginBottom: 12 },
  searchInput: { paddingVertical: 11, color: p.text, fontSize: 14 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  tabOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  tabTxt: { fontSize: 11, fontWeight: '800', color: p.textMuted },
  tabTxtOn: { color: p.neon },
  list: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 40 },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { fontSize: 15, fontWeight: '700', color: p.textMuted },
  emptySub: { fontSize: 12, color: p.textDim, marginTop: 6, textAlign: 'center' },
  emptyBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: p.neon },
  emptyBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  avatarWrap: { width: 52, height: 52, position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 20, fontWeight: '900', color: p.neon },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: p.neon, borderWidth: 2, borderColor: p.obsidian },
  rowBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  chev: { fontSize: 22, color: p.textDim },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.neon },
  unblockTxt: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
});
