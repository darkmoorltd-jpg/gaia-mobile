import { useCallback, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Image, Alert, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import {
  blockUser, hideConversation, listBlockedIds, listHiddenIds,
} from '../../src/utils/friends';

interface Row {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  room_id: string | null;
  last_message: string;
  last_at: string | null;
  last_sender_is_me: boolean;
  unread: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  online: boolean;
}

type Filter = 'all' | 'unread' | 'archived';

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(iso).toLocaleDateString();
}

export default function ChatTab() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [groups, setGroups] = useState<any[]>([]);
  const [menuFor, setMenuFor] = useState<Row | null>(null);

  const load = useCallback(async () => {
    if (!user) { setBusy(false); return; }
    setBusy(true);
    try {
      const [blockedIds, hiddenIds] = await Promise.all([
        listBlockedIds(user.id),
        listHiddenIds(user.id),
      ]);
      const blockedSet = new Set(blockedIds);
      const hiddenSet = new Set(hiddenIds);

      // load groups
      const { data: myGroups } = await supabase
        .from('chat_members')
        .select('room_id')
        .eq('user_id', user.id);
      const groupRoomIds = (myGroups || []).map((m: any) => m.room_id);
      if (groupRoomIds.length > 0) {
        const { data: roomRows } = await supabase
          .from('chat_rooms')
          .select('id,name,avatar_url,is_group,updated_at')
          .in('id', groupRoomIds)
          .eq('is_group', true);
        setGroups(roomRows || []);
      } else {
        setGroups([]);
      }

      // friendships
      const { data: fships } = await supabase
        .from('friendships')
        .select('sender_id,receiver_id')
        .eq('status', 'accepted');
      const mine = (fships || []).filter((r: any) => r.sender_id === user.id || r.receiver_id === user.id);
      const friendIds = mine.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id);

      if (friendIds.length === 0) { setRows([]); setBusy(false); return; }

      // profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name,avatar_url')
        .in('user_id', friendIds);

      // chat_meta for pinned/muted/archived
      const { data: meta } = await supabase
        .from('chat_meta')
        .select('room_id,pinned,muted,archived')
        .eq('user_id', user.id);
      const metaMap: Record<string, any> = {};
      (meta || []).forEach((m: any) => { metaMap[m.room_id] = m; });

      // my chat memberships
      const { data: mems } = await supabase
        .from('chat_members')
        .select('room_id,last_read_at')
        .eq('user_id', user.id);
      const myRoomIds = (mems || []).map((m: any) => m.room_id);
      const readMap: Record<string, string> = {};
      (mems || []).forEach((m: any) => { readMap[m.room_id] = m.last_read_at; });

      // online users
      const { data: presence } = await supabase
        .from('user_presence')
        .select('user_id,last_seen')
        .in('user_id', friendIds);
      const onlineSet = new Set<string>();
      (presence || []).forEach((p: any) => {
        if (p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 120000) onlineSet.add(p.user_id);
      });

      const result: Row[] = [];
      for (const f of (profiles || [])) {
        if (blockedSet.has(f.user_id)) continue;
        if (hiddenSet.has(f.user_id)) continue;

        let roomId: string | null = null;
        let lastMessage = '';
        let lastAt: string | null = null;
        let lastSenderIsMe = false;
        let unread = 0;

        if (myRoomIds.length > 0) {
          const { data: theirMems } = await supabase
            .from('chat_members').select('room_id').eq('user_id', f.user_id);
          const theirRoomIds = (theirMems || []).map((m: any) => m.room_id);
          roomId = myRoomIds.find((id: string) => theirRoomIds.includes(id)) || null;

          if (roomId) {
            const { data: msgs } = await supabase
              .from('chat_messages')
              .select('body,created_at,sender_id,deleted_for_everyone')
              .eq('room_id', roomId)
              .order('created_at', { ascending: false })
              .limit(50);
            const all = msgs || [];
            if (all.length > 0) {
              lastMessage = all[0].deleted_for_everyone ? 'This message was deleted' : all[0].body;
              lastAt = all[0].created_at;
              lastSenderIsMe = all[0].sender_id === user.id;
              const myReadAt = readMap[roomId] || '1970-01-01T00:00:00Z';
              unread = all.filter((m: any) => m.sender_id !== user.id && new Date(m.created_at) > new Date(myReadAt)).length;
            }
          }
        }

        const fullName = ((f.first_name || '') + ' ' + (f.last_name || '')).trim() || (f.email ? f.email.split('@')[0] : 'Farmer');
        const m = roomId ? metaMap[roomId] : null;
        result.push({
          user_id: f.user_id,
          name: fullName,
          email: f.email || '',
          avatar_url: f.avatar_url || null,
          room_id: roomId,
          last_message: lastMessage,
          last_at: lastAt,
          last_sender_is_me: lastSenderIsMe,
          unread,
          pinned: !!(m && m.pinned),
          muted: !!(m && m.muted),
          archived: !!(m && m.archived),
          online: onlineSet.has(f.user_id),
        });
      }

      // sort: pinned first, then last_at desc
      result.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (!a.last_at && !b.last_at) return 0;
        if (!a.last_at) return 1;
        if (!b.last_at) return -1;
        return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
      });
      setRows(result);
    } catch (e) { console.log('chat load error', e); }
    finally { setBusy(false); setRefreshing(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(() => {
    let base = rows;
    if (filter === 'archived') base = base.filter((r) => r.archived);
    else base = base.filter((r) => !r.archived);
    if (filter === 'unread') base = base.filter((r) => r.unread > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.last_message.toLowerCase().includes(q));
    }
    return base;
  }, [rows, filter, search]);

  const unreadTotal = rows.filter((r) => r.unread > 0 && !r.archived).length;

  const togglePin = async (r: Row) => {
    setMenuFor(null);
    if (!r.room_id || !user) return;
    const next = !r.pinned;
    await supabase.from('chat_meta').upsert({
      user_id: user.id, room_id: r.room_id, pinned: next,
      pinned_at: next ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,room_id' });
    load();
  };

  const toggleMute = async (r: Row) => {
    setMenuFor(null);
    if (!r.room_id || !user) return;
    const next = !r.muted;
    await supabase.from('chat_meta').upsert({
      user_id: user.id, room_id: r.room_id, muted: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,room_id' });
    load();
  };

  const toggleArchive = async (r: Row) => {
    setMenuFor(null);
    if (!r.room_id || !user) return;
    const next = !r.archived;
    await supabase.from('chat_meta').upsert({
      user_id: user.id, room_id: r.room_id, archived: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,room_id' });
    load();
  };

  const deleteChat = (r: Row) => {
    setMenuFor(null);
    Alert.alert('Delete chat?', 'This removes it from your list only.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!user) return;
        const err = await hideConversation(user.id, r.user_id);
        if (err) { Alert.alert('Failed', err); return; }
        setRows((prev) => prev.filter((x) => x.user_id !== r.user_id));
      }},
    ]);
  };

  const blockChat = (r: Row) => {
    setMenuFor(null);
    Alert.alert('Block ' + r.name + '?', 'They will be removed from your list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        if (!user) return;
        const err = await blockUser(user.id, r.user_id);
        if (err) { Alert.alert('Failed', err); return; }
        setRows((prev) => prev.filter((x) => x.user_id !== r.user_id));
      }},
    ]);
  };

  const Avatar = ({ uri, name, online, size = 52 }: any) => (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.neonSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.4, fontWeight: '900', color: palette.neon }}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      {online ? (
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#25d366', borderWidth: 2, borderColor: palette.obsidian }} />
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>MESSAGES</Text>
            <Text style={styles.brand}>Chats</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/blocked-users' as any)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>X</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/friend-requests' as any)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>R</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/create-group' as any)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>G</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.iconBtnSolid}>
              <Text style={styles.iconBtnSolidText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.search}>
          <Text style={styles.searchIcon}>S</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder='Search chats'
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
            autoCapitalize='none'
          />
        </View>

        <View style={styles.filterRow}>
          {(['all', 'unread', 'archived'] as Filter[]).map((f) => {
            const on = filter === f;
            const label = f === 'all' ? 'All' : f === 'unread' ? ('Unread' + (unreadTotal > 0 ? ' · ' + unreadTotal : '')) : 'Archived';
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, on && styles.filterChipOn]}>
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {busy && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.centerText}>Loading chats...</Text>
        </View>
      ) : (
        {groups.length > 0 && filter === 'all' && !search ? (
          <View style={styles.groupsWrap}>
            <Text style={styles.sectionLabel}>GROUPS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsRow}>
              {groups.map((g) => (
                <Pressable key={g.id} onPress={() => router.push(('/chat-room?room=' + g.id + '&group=1') as any)} style={styles.groupChip}>
                  <View style={styles.groupAvatar}>
                    {g.avatar_url ? (
                      <Image source={{ uri: g.avatar_url }} style={styles.groupAvatarImg} />
                    ) : (
                      <Text style={styles.groupAvatarTxt}>{String(g.name || 'G').charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={styles.groupName} numberOfLines={1}>{g.name || 'Group'}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.neon} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{search ? 'No matching chats' : filter === 'archived' ? 'No archived chats' : filter === 'unread' ? 'No unread chats' : 'No chats yet'}</Text>
              <Text style={styles.emptySub}>{search ? 'Try a different name or email.' : 'Add a friend to start chatting.'}</Text>
              {!search && filter === 'all' ? (
                <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>ADD A FRIEND</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(('/chat-room?uid=' + item.user_id) as any)}
              onLongPress={() => setMenuFor(item)}
              delayLongPress={350}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Avatar uri={item.avatar_url} name={item.name} online={item.online} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {item.pinned ? <Text style={styles.pinBadge}>PIN</Text> : null}
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    {item.muted ? <Text style={styles.muteBadge}>MUTE</Text> : null}
                  </View>
                  <Text style={styles.time}>{timeAgo(item.last_at)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                    {item.last_sender_is_me ? 'You: ' : ''}{item.last_message || 'Tap to start chatting'}
                  </Text>
                  {item.unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!menuFor} transparent animationType='slide' onRequestClose={() => setMenuFor(null)}>
        <Pressable style={styles.menuBg} onPress={() => setMenuFor(null)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>{menuFor?.name}</Text>
            <Pressable onPress={() => menuFor && togglePin(menuFor)} style={styles.menuItem}>
              <Text style={styles.menuItemTxt}>{menuFor?.pinned ? 'Unpin chat' : 'Pin chat'}</Text>
            </Pressable>
            <Pressable onPress={() => menuFor && toggleMute(menuFor)} style={styles.menuItem}>
              <Text style={styles.menuItemTxt}>{menuFor?.muted ? 'Unmute' : 'Mute notifications'}</Text>
            </Pressable>
            <Pressable onPress={() => menuFor && toggleArchive(menuFor)} style={styles.menuItem}>
              <Text style={styles.menuItemTxt}>{menuFor?.archived ? 'Unarchive' : 'Archive chat'}</Text>
            </Pressable>
            <Pressable onPress={() => menuFor && deleteChat(menuFor)} style={styles.menuItem}>
              <Text style={[styles.menuItemTxt, { color: palette.danger }]}>Delete chat</Text>
            </Pressable>
            <Pressable onPress={() => menuFor && blockChat(menuFor)} style={styles.menuItem}>
              <Text style={[styles.menuItemTxt, { color: palette.danger }]}>Block user</Text>
            </Pressable>
            <Pressable onPress={() => setMenuFor(null)} style={[styles.menuItem, { borderBottomWidth: 0 }]}>
              <Text style={styles.menuItemTxt}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md },
  kicker: { ...typography.micro, color: palette.neon },
  brand: { fontSize: 34, fontWeight: '900', letterSpacing: -1, color: palette.text, marginTop: 4 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 14, fontWeight: '900', color: palette.neon },
  iconBtnSolid: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.neon, alignItems: 'center', justifyContent: 'center' },
  iconBtnSolidText: { fontSize: 22, fontWeight: '900', color: palette.obsidian, lineHeight: 24 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginBottom: 10 },
  searchIcon: { fontSize: 14, fontWeight: '900', color: palette.neon },
  searchInput: { flex: 1, paddingVertical: 12, color: palette.text, fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  filterChipOn: { backgroundColor: 'rgba(0,255,136,0.15)', borderColor: palette.neon },
  filterText: { fontSize: 11, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.5 },
  filterTextOn: { color: palette.neon },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  centerText: { ...typography.caption, color: palette.textMuted },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: palette.text },
  emptySub: { ...typography.body, color: palette.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 22 },
  emptyBtn: { marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.md, backgroundColor: palette.neon },
  emptyBtnText: { ...typography.micro, color: palette.obsidian, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, marginBottom: 4 },
  rowPressed: { backgroundColor: palette.surface },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.body, fontWeight: '700', color: palette.text, flex: 1 },
  pinBadge: { fontSize: 8, fontWeight: '900', color: palette.neon, letterSpacing: 1, borderWidth: 1, borderColor: palette.neon, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  muteBadge: { fontSize: 8, fontWeight: '900', color: palette.textDim, letterSpacing: 1 },
  time: { ...typography.micro, color: palette.textDim, marginLeft: spacing.sm },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  lastMessage: { ...typography.caption, color: palette.textMuted, flex: 1, marginRight: spacing.sm },
  lastMessageUnread: { color: palette.text, fontWeight: '700' },
  badge: { backgroundColor: '#25d366', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  menuBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: palette.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  menuTitle: { fontSize: 18, fontWeight: '900', color: palette.text, marginBottom: 12 },
  menuItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border },
  menuItemTxt: { fontSize: 14, fontWeight: '700', color: palette.text },
});
