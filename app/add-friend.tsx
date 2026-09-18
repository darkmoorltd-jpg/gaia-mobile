import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { searchUserByEmail, sendFriendRequest, displayName } from '../src/utils/friends';

export default function AddFriend() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const search = async () => {
    if (query.trim().length < 3) return;
    setBusy(true);
    setMsg('');
    const r = await searchUserByEmail(query);
    setResults(r.filter((x) => x.user_id !== user?.id));
    setBusy(false);
  };

  const invite = async (receiverId: string) => {
    if (!user) return;
    const err = await sendFriendRequest(user.id, receiverId);
    setMsg(err ? 'Failed: ' + err : 'Request sent');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Add a farmer</Text>
        <Text style={styles.sub}>Search by email address</Text>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="farmer@example.com"
            placeholderTextColor={palette.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            onSubmitEditing={search}
          />
          <Pressable onPress={search} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>SEARCH</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        {results.map((r) => (
          <View key={r.user_id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(r.first_name || r.email || 'F')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName(r)}</Text>
              <Text style={styles.email}>{r.email}</Text>
            </View>
            <Pressable onPress={() => invite(r.user_id)} style={styles.inviteBtn}>
              <Text style={styles.inviteText}>INVITE</Text>
            </Pressable>
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
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: p.border,
    backgroundColor: p.surface, color: p.text, fontSize: 14,
  },
  searchBtn: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: radius.md, backgroundColor: p.neon,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  msg: { fontSize: 12, color: p.neon, marginTop: 12, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12,
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
  inviteBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: p.neon,
  },
  inviteText: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
