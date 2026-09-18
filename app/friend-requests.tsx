import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { listPendingRequests, acceptFriendRequest, rejectFriendRequest, displayName } from '../src/utils/friends';

export default function FriendRequests() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setRows(await listPendingRequests(user.id));
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accept = async (id: number) => { await acceptFriendRequest(id); load(); };
  const reject = async (id: number) => { await rejectFriendRequest(id); load(); };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Friend requests</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}
        {!busy && rows.length === 0 ? (
          <Text style={styles.empty}>No pending requests.</Text>
        ) : null}

        {rows.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {((r.sender && (r.sender.first_name || r.sender.email)) || 'F')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName(r.sender || {})}</Text>
              <Text style={styles.email}>{r.sender?.email || ''}</Text>
            </View>
            <View style={styles.actionRow}>
              <Pressable onPress={() => accept(r.id)} style={styles.accept}>
                <Text style={styles.acceptText}>ACCEPT</Text>
              </Pressable>
              <Pressable onPress={() => reject(r.id)} style={styles.reject}>
                <Text style={styles.rejectText}>X</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 20 },
  empty: { fontSize: 14, color: p.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
    padding: 14, borderRadius: radius.md, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: p.neon },
  name: { fontSize: 15, fontWeight: '700', color: p.text },
  email: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 6 },
  accept: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.neon },
  acceptText: { fontSize: 10, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  reject: {
    width: 36, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1.5, borderColor: p.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectText: { fontSize: 12, fontWeight: '900', color: p.danger },
});
