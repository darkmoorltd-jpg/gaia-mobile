import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { ensureMyProfile, listFriends, displayName } from '../src/utils/friends';

export default function Chat() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [friends, setFriends] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setBusy(true);
      setError(null);
      if (!user) {
        setError('No user signed in');
        setBusy(false);
        return;
      }
      console.log('[chat] user.id:', user.id);
      console.log('[chat] user.email:', user.email);

      await ensureMyProfile(user.id, user.email || '');
      console.log('[chat] ensureMyProfile done');

      const f = await listFriends(user.id);
      console.log('[chat] listFriends returned:', f.length);
      setFriends(f);
    } catch (e: any) {
      console.error('[chat] load error:', e);
      setError(e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = search.trim()
    ? friends.filter((f) => (f.email || '').toLowerCase().includes(search.toLowerCase()))
    : friends;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.brand}>Chats</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => router.push('/friend-requests' as any)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>R</Text>
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
            placeholder="Search friends"
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {busy ? (
          <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} />
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <Pressable onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>RETRY</Text>
            </Pressable>
          </View>
        ) : null}

        {!busy && !error && friends.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>Add a farmer by email to start messaging.</Text>
            <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>ADD A FARMER</Text>
            </Pressable>
          </View>
        ) : null}

        {filtered.map((f) => (
          <Pressable
            key={f.user_id}
            onPress={() => router.push({
              pathname: '/chat-room',
              params: {
                peerId: f.user_id,
                peerEmail: f.email,
                peerName: displayName(f),
              },
            } as any)}
            style={styles.row}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName(f)[0].toUpperCase()}</Text>
              <View style={styles.onlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName(f)}</Text>
              <Text style={styles.email} numberOfLines={1}>{f.email}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  topBar: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: p.obsidian },
  brand: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 14, fontWeight: '900', color: p.neon },
  iconBtnSolid: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: p.neon,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnSolidText: { fontSize: 22, fontWeight: '900', color: p.obsidian, lineHeight: 24 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.md, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
  },
  searchIcon: { fontSize: 12, fontWeight: '900', color: p.neon },
  searchInput: { flex: 1, color: p.text, fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  emptyBox: { marginTop: 40, alignItems: 'center', paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: p.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: p.textMuted, textAlign: 'center', marginBottom: 16 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.md, backgroundColor: p.neon },
  emptyBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  errorBox: { marginTop: 20, padding: 16, borderRadius: radius.md, backgroundColor: 'rgba(255,60,90,0.1)', borderWidth: 1, borderColor: '#ff3b5c' },
  errorText: { color: '#ff3b5c', fontSize: 13, marginBottom: 10 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: p.neon, alignSelf: 'flex-start' },
  retryText: { fontSize: 11, fontWeight: '900', color: p.obsidian },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: p.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { fontSize: 20, fontWeight: '900', color: p.neon },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: p.neon, borderWidth: 2, borderColor: p.obsidian },
  name: { fontSize: 15, fontWeight: '700', color: p.text },
  email: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  chev: { fontSize: 22, color: p.textDim },
});
