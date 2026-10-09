import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Image, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import { useChatStore } from '../../src/store/chat';
import { blockUser, hideConversation, listBlockedIds, listHiddenIds } from '../../src/utils/friends';

interface Row {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  room_id: string | null;
  last_message: string;
  last_at: string | null;
  last_sender_is_me: boolean;
  last_read: boolean;
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
  const setUnread = useChatStore((s) => s.setUnread);

  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

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

      const { data: fships } = await supabase
        .from('friendships')
        .select('sender_id,receiver_id')
        .eq('status', 'accepted');

      const mine = (fships || []).filter((r: any) => r.sender_id === user.id || r.receiver_id === user.id);
      const friendIds = mine.map((r: any) => (r.sender_id === user.id ? r.receiver_id : r.sender_id));
      if (friendIds.length === 0) { setRows([]); setBusy(false); setUnread(0); return; }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name,avatar_url')
        .in('user_id', friendIds);

      const { data: presences } = await supabase
        .from('user_presence')
        .select('user_id,last_seen')
        .in('user_id', friendIds);
      const onlineSet = new Set(
        (presences || [])
          .filter((p: any) => p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 120000)
          .map((p: any) => p.user_id)
      );

      const { data: mems } = await supabase
        .from('chat_members')
        .select('room_id,last_read_at')
        .eq('user_id', user.id);
      const myRoomIds = (mems || []).map((m: any) => m.room_id);
      const readMap: Record<string, string> = {};
      (mems || []).forEach((m: any) => { readMap[m.room_id] = m.last_read_at; });

      let metaMap: Record<string, any> = {};
      try {
        const { data: metas } = await supabase
          .from('chat_meta')
          .select('*')
          .eq('user_id', user.id);
        (metas || []).forEach((m: any) => {
          const key = m.other_user_id || m.peer_id || m.room_id;
          if (key) metaMap[key] = m;
        });
      } catch {}

      const result: Row[] = [];
      for (const f of (profiles || [])) {
        if (blockedSet.has(f.user_id)) continue;
        if (hiddenSet.has(f.user_id)) continue;
        let roomId: string | null = null;
        let lastMessage = '';
        let lastAt: string | null = null;
        let lastSenderIsMe = false;
        let lastRead = true;
        let unread = 0;

        if (myRoomIds.length > 0) {
          const { data: theirMems } = await supabase
            .from('chat_members')
            .select('room_id')
            .eq('user_id', f.user_id);
          const theirRoomIds = (theirMems || []).map((m: any) => m.room_id);
          roomId = myRoomIds.find((id: string) => theirRoomIds.includes(id)) || null;
          if (roomId) {
            const { data: msgs } = await supabase
              .from('chat_messages')
              .select('body,sender_id,created_at,read_at')
              .eq('room_id', roomId)
              .order('created_at', { ascending: false })
              .limit(30);
            const all = (msgs || []);
            if (all.length > 0) {
              lastMessage = all[0].body || '';
              lastAt = all[0].created_at;
              lastSenderIsMe = all[0].sender_id === user.id;
              lastRead = !!all[0].read_at;
              const myReadAt = readMap[roomId] || '1970-01-01T00:00:00Z';
              unread = all.filter((m: any) =>
                m.sender_id !== user.id && new Date(m.created_at) > new Date(myReadAt)
              ).length;
            }
          }
        }

        const meta = metaMap[f.user_id] || {};
        const fullName = ((f.first_name || '') + ' ' + (f.last_name || '')).trim() || (f.email ? f.email.split('@')[0] : 'Farmer');
        result.push({
          user_id: f.user_id,
          name: fullName,
          email: f.email || '',
          avatar_url: f.avatar_url || null,
          room_id: roomId,
          last_message: lastMessage,
          last_at: lastAt,
          last_sender_is_me: lastSenderIsMe,
          last_read: lastRead,
          unread,
          pinned: !!meta.pinned,
          muted: !!meta.muted,
          archived: !!meta.archived,
          online: onlineSet.has(f.user_id),
        });
      }

      result.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (!a.last_at && !b.last_at) return 0;
        if (!a.last_at) return 1;
        if (!b.last_at) return -1;
        return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
      });

      const totalUnread = result.reduce((s, r) => s + r.unread, 0);
      setUnread(totalUnread);
      setRows(result);
    } catch (e) {
      console.log('chat load error', e);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [user, setUnread]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setMeta = async (otherId: string, patch: Record<string, any>) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from('chat_meta')
        .select('*')
        .eq('user_id', user.id)
        .eq('other_user_id', otherId)
        .maybeSingle();
      if (existing) {
        await supabase.from('chat_meta').update(patch).eq('user_id', user.id).eq('other_user_id', otherId);
      } else {
        await supabase.from('chat_meta').insert({ user_id: user.id, other_user_id: otherId, ...patch });
      }
    } catch (e) { console.log('setMeta failed', e); }
  };

  const openRowMenu = (row: Row) => {
    Alert.alert(row.name, 'Chat options', [
      { text: row.pinned ? 'Unpin' : 'Pin', onPress: async () => { await setMeta(row.user_id, { pinned: !row.pinned }); load(); } },
      { text: row.muted ? 'Unmute' : 'Mute', onPress: async () => { await setMeta(row.user_id, { muted: !row.muted }); load(); } },
      { text: row.archived ? 'Unarchive' : 'Archive', onPress: async () => { await setMeta(row.user_id, { archived: !row.archived }); load(); } },
      { text: 'Delete chat', style: 'destructive', onPress: () => confirmDelete(row) },
      { text: 'Block user', style: 'destructive', onPress: () => confirmBlock(row) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmDelete = (row: Row) => {
    Alert.alert('Delete chat?', 'Removes it from your list. The other person keeps their copy.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!user) return;
        const err = await hideConversation(user.id, row.user_id);
        if (err) { Alert.alert('Failed', err); return; }
        setRows((prev) => prev.filter((r) => r.user_id !== row.user_id));
      }},
    ]);
  };

  const confirmBlock = (row: Row) => {
    Alert.alert('Block ' + row.name + '?', 'They will be removed from your friends and cannot message you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        if (!user) return;
        const err = await blockUser(user.id, row.user_id);
        if (err) { Alert.alert('Failed', err); return; }
        setRows((prev) => prev.filter((r) => r.user_id !== row.user_id));
      }},
    ]);
  };

  const visible = rows
    .filter((r) => filter === 'archived' ? r.archived : !r.archived)
    .filter((r) => filter !== 'unread' || r.unread > 0)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.last_message.toLowerCase().includes(q);
    });

  const unreadCount = rows.filter((r) => !r.archived).reduce((s, r) => s + r.unread, 0);
  const archivedCount = rows.filter((r) => r.archived).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>Chats</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setSearchOpen(!searchOpen)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>Q</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.iconBtnSolid}>
              <Text style={styles.iconBtnSolidText}>+</Text>
            </Pressable>
          </View>
        </View>

        {searchOpen ? (
          <View style={styles.search}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder='Search chats'
              placeholderTextColor={palette.textDim}
              style={styles.searchInput}
              autoCapitalize='none'
            />
          </View>
        ) : null}

        <View style={styles.tabs}>
          {(['all', 'unread', 'archived'] as Filter[]).map((f) => {
            const label = f === 'all'
              ? (unreadCount > 0 ? 'All (' + unreadCount + ')' : 'All')
              : f === 'unread'
                ? (unreadCount > 0 ? 'Unread (' + unreadCount + ')' : 'Unread')
                : (archivedCount > 0 ? 'Archived (' + archivedCount + ')' : 'Archived');
            const on = filter === f;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {busy && rows.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{filter === 'unread' ? 'No unread chats' : filter === 'archived' ? 'No archived chats' : 'No chats yet'}</Text>
              <Text style={styles.emptySub}>{filter === 'all' ? 'Add a friend to start chatting.' : ''}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(('/chat-room?uid=' + item.user_id) as any)}
              onLongPress={() => openRowMenu(item)}
              delayLongPress={350}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.avatarWrap}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}><Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text></View>
                )}
                {item.online ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <View style={styles.nameRow}>
                    {item.pinned ? <Text style={styles.pinIcon}>P</Text> : null}
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    {item.muted ? <Text style={styles.muteIcon}>M</Text> : null}
                  </View>
                  <Text style={[styles.time, item.unread > 0 && { color: palette.neon, fontWeight: '800' }]}>{timeAgo(item.last_at)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <View style={styles.msgRow}>
                    {item.last_sender_is_me ? (
                      <Text style={[styles.tick, item.last_read ? styles.tickRead : styles.tickSent]}>
                        {item.last_read ? 'DONE' : 'SENT'}
                      </Text>
                    ) : null}
                    <Text style={[styles.lastMessage, item.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                      {item.last_sender_is_me ? 'You: ' : ''}{item.last_message || 'Tap to start chatting'}
                    </Text>
                  </View>
                  {item.unread > 0 && !item.muted ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text></View>
                  ) : null}
                  {item.unread > 0 && item.muted ? (
                    <View style={[styles.badge, styles.badgeMuted]}><Text style={[styles.badgeText, styles.badgeTextMuted]}>{item.unread > 99 ? '99+' : item.unread}</Text></View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { fontSize: 32, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 14, fontWeight: '900', color: palette.neon },
  iconBtnSolid: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.neon, alignItems: 'center', justifyContent: 'center' },
  iconBtnSolidText: { fontSize: 22, fontWeight: '900', color: palette.obsidian, lineHeight: 24 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, color: palette.text, fontSize: 14 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  tabOn: { borderColor: palette.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  tabTxt: { fontSize: 11, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.5 },
  tabTxtOn: { color: palette.neon },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: palette.textMuted },
  emptySub: { fontSize: 12, color: palette.textDim, marginTop: 6, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  avatarWrap: { width: 54, height: 54, position: 'relative' },
  avatarImg: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: palette.neonSoft, borderWidth: 1, borderColor: palette.borderHi, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '900', color: palette.neon },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: palette.neon, borderWidth: 2, borderColor: palette.obsidian },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  pinIcon: { fontSize: 10, color: palette.neon, fontWeight: '900' },
  muteIcon: { fontSize: 10, color: palette.textDim, fontWeight: '900' },
  name: { fontSize: 15, fontWeight: '800', color: palette.text, flexShrink: 1 },
  time: { fontSize: 11, color: palette.textMuted, fontWeight: '600' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  tick: { fontSize: 9, marginRight: 4, fontWeight: '900', letterSpacing: 0.5 },
  tickRead: { color: '#4fc3f7' },
  tickSent: { color: palette.textMuted },
  lastMessage: { fontSize: 13, color: palette.textMuted, flex: 1 },
  lastMessageUnread: { color: palette.text, fontWeight: '700' },
  badge: { backgroundColor: palette.neon, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  badgeMuted: { backgroundColor: 'rgba(255,255,255,0.1)' },
  badgeText: { fontSize: 11, fontWeight: '900', color: palette.obsidian },
  badgeTextMuted: { color: palette.textMuted },
});
