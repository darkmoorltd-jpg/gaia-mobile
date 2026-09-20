import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function FriendRequests() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [requests, setRequests] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: rows } = await supabase
        .from('friendships')
        .select('id,sender_id')
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      const senders = (rows || []).map((r: any) => r.sender_id);

      if (senders.length === 0) {
        setRequests([]);
        setBusy(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name')
        .in('user_id', senders);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      const result = (rows || []).map((r: any) => ({
        id: r.id,
        sender_id: r.sender_id,
        profile: profileMap[r.sender_id] || {},
      }));

      setRequests(result);
    } catch (e) {
      console.log(e);
    } finally {
      setBusy(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (id: number, status: 'accepted' | 'rejected') => {
    await supabase.from('friendships').update({ status }).eq('id', id);
    load();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Friend requests</Text>
        <Text style={styles.sub}>People who want to connect</Text>
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySub}>When someone adds you, it appears here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const p = item.profile || {};
            const name =
              ((p.first_name || '') + ' ' + (p.last_name || '')).trim() ||
              (p.email ? p.email.split('@')[0] : 'Farmer');
            return (
              <View style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.email}>{p.email}</Text>
                </View>
                <Pressable
                  onPress={() => respond(item.id, 'accepted')}
                  style={styles.accept}
                >
                  <Text style={styles.acceptText}>ACCEPT</Text>
                </Pressable>
                <Pressable
                  onPress={() => respond(item.id, 'rejected')}
                  style={styles.reject}
                >
                  <Text style={styles.rejectText}>X</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    header: { padding: spacing.xl, paddingTop: 60 },
    back: { ...typography.micro, color: palette.textMuted, marginBottom: spacing.lg },
    title: { fontSize: 30, fontWeight: '900', color: palette.text, letterSpacing: -1 },
    sub: { ...typography.body, color: palette.textMuted, marginTop: 6 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { ...typography.heading, color: palette.text },
    emptySub: { ...typography.body, color: palette.textMuted, marginTop: 6, textAlign: 'center' },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      marginBottom: spacing.sm,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: palette.neonSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '900', color: palette.neon },
    name: { ...typography.body, fontWeight: '700', color: palette.text },
    email: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    accept: {
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: radius.md, backgroundColor: palette.neon,
    },
    acceptText: { fontSize: 11, fontWeight: '900', color: palette.obsidian },
    reject: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      alignItems: 'center', justifyContent: 'center',
    },
    rejectText: { fontSize: 14, color: palette.danger, fontWeight: '900' },
  });
