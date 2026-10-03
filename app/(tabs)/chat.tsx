import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Image, Alert,
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
  unread: number;
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

  const load = useCallback(async () => {
    if (!user) { setBusy(false); return; }
    setBusy(true);
    try {
      // Hidden + blocked for me
      const [blockedIds, hiddenIds] = await Promise.all([
        listBlockedIds(user.id),
        listHiddenIds(user.id),
      ]);
      const blockedSet = new Set(blockedIds);
      const hiddenSet = new Set(hiddenIds);

      // My accepted friendships
      const { data: fships } = await supabase
        .from('friendships')
        .select('sender_id,receiver_id')
        .eq('status', 'accepted');

      const mine = (fships || []).filter(
        (r: any) => r.sender_id === user.id || r.receiver_id === user.id,
      );
      const friendIds = mine.map((r: any) =>
        r.sender_id === user.id ? r.receiver_id : r.sender_id,
      );

      if (friendIds.length === 0) {
        setRows([]);
        setBusy(false);
        return;
      }

      // Friend profiles (with avatar)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name,avatar_url')
        .in('user_id', friendIds);

      // My chat memberships
      const { data: mems } = await supabase
        .from('chat_members')
        .select('room_id,last_read_at')
        .eq('user_id', user.id);

      const myRoomIds = (mems || []).map((m: any) => m.room_id);
      const readMap: Record<string, string> = {};
      (mems || []).forEach((m: any) => { readMap[m.room_id] = m.last_read_at; });

      const result: Row[] = [];

      for (const f of (profiles || [])) {
        // Skip blocked or hidden
        if (blockedSet.has(f.user_id)) continue;
        if (hiddenSet.has(f.user_id)) continue;

        let roomId: string | null = null;
        let lastMessage = '';
        let lastAt: string | null = null;
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
              .select('body,created_at,sender_id')
              .eq('room_id', roomId)
              .order('created_at', { ascending: false })
              .limit(50);

            const all = msgs || [];
            if (all.length > 0) {
              lastMessage = all[0].body;
              lastAt = all[0].created_at;

              const myReadAt = readMap[roomId] || '1970-01-01T00:00:00Z';
              unread = all.filter(
                (m: any) =>
                  m.sender_id !== user.id &&
                  new Date(m.created_at) > new Date(myReadAt),
              ).length;
            }
          }
        }

        const fullName =
          ((f.first_name || '') + ' ' + (f.last_name || '')).trim() ||
          (f.email ? f.email.split('@')[0] : 'Farmer');

        result.push({
          user_id: f.user_id,
          name: fullName,
          email: f.email || '',
          avatar_url: f.avatar_url || null,
          room_id: roomId,
          last_message: lastMessage,
          last_at: lastAt,
          unread,
        });
      }

      result.sort((a, b) => {
        if (!a.last_at && !b.last_at) return 0;
        if (!a.last_at) return 1;
        if (!b.last_at) return -1;
        return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
      });

      setRows(result);
    } catch (e) {
      console.log('chat load error', e);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = search.trim()
    ? rows.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  const timeAgo = (iso: string | null) => {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 604800) return Math.floor(s / 86400) + 'd';
    return new Date(iso).toLocaleDateString();
  };

  // ---------- Row menu (long-press) ----------
  const openRowMenu = (row: Row) => {
    Alert.alert(
      row.name,
      'Choose an action',
      [
        {
          text: 'Delete chat',
          style: 'destructive',
          onPress: () => confirmDeleteChat(row),
        },
        {
          text: 'Block user',
          style: 'destructive',
          onPress: () => confirmBlock(row),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const confirmDeleteChat = (row: Row) => {
    Alert.alert(
      'Delete chat?',
      'This removes the conversation from your list. The other person will still see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const err = await hideConversation(user.id, row.user_id);
            if (err) { Alert.alert('Failed', err); return; }
            setRows((prev) => prev.filter((r) => r.user_id !== row.user_id));
          },
        },
      ],
    );
  };

  const confirmBlock = (row: Row) => {
    Alert.alert(
      'Block ' + row.name + '?',
      'They will be removed from your friends and cannot message you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const err = await blockUser(user.id, row.user_id);
            if (err) { Alert.alert('Failed', err); return; }
            setRows((prev) => prev.filter((r) => r.user_id !== row.user_id));
            Alert.alert('Blocked', row.name + ' has been blocked.');
          },
        },
      ],
    );
  };

  const Avatar = ({ uri, name, size = 52 }: { uri: string | null; name: string; size?: number }) => {
    if (uri) {
      return (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }
    return (
      <View
        style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: palette.neonSoft,
          borderWidth: 1, borderColor: palette.borderHi,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size * 0.42, fontWeight: '900', color: palette.neon }}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>MESSAGES</Text>
            <Text style={styles.brand}>Chats</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/blocked-users' as any)}
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>X</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/friend-requests' as any)}
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>R</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/add-friend' as any)}
              style={styles.iconBtnSolid}
            >
              <Text style={styles.iconBtnSolidText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.search}>
          <Text style={styles.searchIcon}>S</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search chats"
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
      </View>

      {busy && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.centerText}>Loading chats…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.neon}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>M</Text>
              <Text style={styles.emptyTitle}>
                {search ? 'No matching chats' : 'No chats yet'}
              </Text>
              <Text style={styles.emptySub}>
                {search
                  ? 'Try a different name or email.'
                  : 'Add a friend to start chatting with fellow farmers.'}
              </Text>
              {!search ? (
                <Pressable
                  onPress={() => router.push('/add-friend' as any)}
                  style={styles.emptyBtn}
                >
                  <Text style={styles.emptyBtnText}>ADD A FRIEND</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(('/chat-room?uid=' + item.user_id) as any)
              }
              onLongPress={() => openRowMenu(item)}
              delayLongPress={350}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Avatar uri={item.avatar_url} name={item.name} />

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.time}>{timeAgo(item.last_at)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    style={[
                      styles.lastMessage,
                      item.unread > 0 && { color: palette.text, fontWeight: '600' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.last_message || 'Tap to start chatting'}
                  </Text>
                  {item.unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.unread > 99 ? '99+' : item.unread}
                      </Text>
                    </View>
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

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: 60,
      paddingBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: spacing.lg,
    },
    kicker: { ...typography.micro, color: palette.neon },
    brand: {
      fontSize: 34, fontWeight: '900', letterSpacing: -1,
      color: palette.text, marginTop: 4,
    },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    iconBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      alignItems: 'center', justifyContent: 'center',
    },
    iconBtnText: { fontSize: 14, fontWeight: '900', color: palette.neon },
    iconBtnSolid: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: palette.neon,
      alignItems: 'center', justifyContent: 'center',
    },
    iconBtnSolidText: {
      fontSize: 22, fontWeight: '900',
      color: palette.obsidian, lineHeight: 24,
    },
    search: {
      flexDirection: 'row', alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
    },
    searchIcon: { fontSize: 14, fontWeight: '900', color: palette.neon },
    searchInput: {
      flex: 1, paddingVertical: 12,
      color: palette.text, fontSize: 14,
    },
    list: { paddingHorizontal: spacing.xl, paddingBottom: 40 },
    center: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      gap: spacing.md,
    },
    centerText: { ...typography.caption, color: palette.textMuted },
    empty: {
      alignItems: 'center', paddingVertical: 60,
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      fontSize: 64, fontWeight: '900',
      color: palette.neonSoft, marginBottom: spacing.lg,
    },
    emptyTitle: { ...typography.heading, color: palette.text },
    emptySub: {
      ...typography.body, color: palette.textMuted,
      marginTop: 6, textAlign: 'center', lineHeight: 22,
    },
    emptyBtn: {
      marginTop: spacing.xl, paddingHorizontal: spacing.xl,
      paddingVertical: 14, borderRadius: radius.md,
      backgroundColor: palette.neon,
    },
    emptyBtnText: {
      ...typography.micro, color: palette.obsidian, fontWeight: '900',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      marginBottom: spacing.sm,
    },
    rowPressed: { opacity: 0.75 },
    rowBody: { flex: 1 },
    rowTop: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    name: {
      ...typography.body, fontWeight: '700',
      color: palette.text, flex: 1, marginRight: spacing.sm,
    },
    time: { ...typography.micro, color: palette.textDim },
    rowBottom: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginTop: 4,
    },
    lastMessage: {
      ...typography.caption, color: palette.textMuted,
      flex: 1, marginRight: spacing.sm,
    },
    badge: {
      backgroundColor: palette.neon, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 2,
      minWidth: 22, alignItems: 'center',
    },
    badgeText: { fontSize: 10, fontWeight: '900', color: palette.obsidian },
  });
