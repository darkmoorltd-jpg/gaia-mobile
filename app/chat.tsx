import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface Profile {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

// Demo chats shown when the user has no real friends yet
const DEMO_CHATS: Profile[] = [
  { user_id: 'demo-1', email: 'farmers-lagos@gaia.app',  first_name: 'Farmers', last_name: 'Lagos Group' },
  { user_id: 'demo-2', email: 'maize-growers@gaia.app',  first_name: 'Maize',   last_name: 'Growers NG' },
  { user_id: 'demo-3', email: 'support@gaia.app',        first_name: 'GAIA',    last_name: 'Support' },
];

export default function Chat() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const user = useAuth((s) => s.user);

  const [friends, setFriends] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [usingDemo, setUsingDemo] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setBusy(false); return; }
    setBusy(true);
    setUsingDemo(false);
    try {
      // Ensure my profile exists
      try {
        await supabase.from('user_profiles').upsert({
          user_id: user.id,
          email: (user.email || '').toLowerCase(),
        }, { onConflict: 'user_id' });
      } catch (_) {}

      // Get my friendships
      let rows: any[] = [];
      try {
        const res = await supabase
          .from('friendships')
          .select('*')
          .eq('status', 'accepted');
        rows = res.data || [];
      } catch (_) {
        rows = [];
      }

      const mine = rows.filter(
        (r: any) => r.sender_id === user.id || r.receiver_id === user.id,
      );
      const ids = mine.map((r: any) =>
        r.sender_id === user.id ? r.receiver_id : r.sender_id,
      );

      if (ids.length === 0) {
        setFriends([]);
        setUsingDemo(true);
        setBusy(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name')
        .in('user_id', ids);

      const realFriends = (profiles || []) as Profile[];
      if (realFriends.length === 0) {
        setFriends([]);
        setUsingDemo(true);
      } else {
        setFriends(realFriends);
      }
    } catch (e) {
      console.log('chat load error', e);
      setFriends([]);
      setUsingDemo(true);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  // If no real friends, fall back to demo chats so the page always shows content
  const baseList = usingDemo ? DEMO_CHATS : friends;

  const filtered = search.trim()
    ? baseList.filter((f) =>
        (f.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.last_name || '').toLowerCase().includes(search.toLowerCase()),
      )
    : baseList;

  const displayName = (p: Profile) => {
    const n = ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
    return n || (p.email ? p.email.split('@')[0] : 'Farmer');
  };

  const initial = (p: Profile) => displayName(p).charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>MESSAGES</Text>
            <Text style={styles.brand}>Chats</Text>
          </View>
          <View style={styles.headerActions}>
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
            placeholder="Search friends"
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Body */}
      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} />
          <Text style={styles.centerText}>Loading chats…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.neon}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {usingDemo ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                You have no friends yet — showing sample chats. Tap + to add someone.
              </Text>
            </View>
          ) : null}

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>C</Text>
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
          ) : (
            filtered.map((f) => (
              <Pressable
                key={f.user_id}
                onPress={() => {
                  if (usingDemo) return; // demo rows are not clickable
                  router.push(('/chat-room?uid=' + f.user_id) as any);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.avatarWrap}>
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{initial(f)}</Text>
                  </View>
                  <View style={styles.onlineDot} />
                </View>

                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {displayName(f)}
                    </Text>
                    <Text style={styles.time}>now</Text>
                  </View>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {f.email}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
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
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1,
      color: palette.text,
      marginTop: 4,
    },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnText: {
      fontSize: 16,
      fontWeight: '900',
      color: palette.neon,
    },
    iconBtnSolid: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.neon,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnSolidText: {
      fontSize: 22,
      fontWeight: '900',
      color: palette.obsidian,
      lineHeight: 24,
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
    },
    searchIcon: { fontSize: 14, fontWeight: '900', color: palette.neon },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      color: palette.text,
      fontSize: 14,
    },
    scroll: { paddingHorizontal: spacing.xl, paddingBottom: 40 },
    banner: {
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: palette.neonSoft,
      borderWidth: 1,
      borderColor: palette.borderHi,
      marginBottom: spacing.md,
    },
    bannerText: {
      ...typography.caption,
      color: palette.neon,
      textAlign: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    centerText: { ...typography.caption, color: palette.textMuted },
    empty: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      fontSize: 64,
      fontWeight: '900',
      color: palette.neonSoft,
      marginBottom: spacing.lg,
    },
    emptyTitle: { ...typography.heading, color: palette.text },
    emptySub: {
      ...typography.body,
      color: palette.textMuted,
      marginTop: 6,
      textAlign: 'center',
      lineHeight: 22,
    },
    emptyBtn: {
      marginTop: spacing.xl,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: palette.neon,
    },
    emptyBtnText: {
      ...typography.micro,
      color: palette.obsidian,
      fontWeight: '900',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: spacing.sm,
    },
    rowPressed: { opacity: 0.75 },
    avatarWrap: { width: 52, height: 52, borderRadius: 26, position: 'relative' },
    avatarFallback: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: palette.neonSoft,
      borderWidth: 1,
      borderColor: palette.borderHi,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '900', color: palette.neon },
    onlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: palette.neon,
      borderWidth: 2,
      borderColor: palette.obsidian,
    },
    rowBody: { flex: 1 },
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    name: {
      ...typography.body,
      fontWeight: '700',
      color: palette.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    time: { ...typography.micro, color: palette.textDim },
    lastMessage: {
      ...typography.caption,
      color: palette.textMuted,
      marginTop: 4,
    },
  });
