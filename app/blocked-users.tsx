import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image, Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { listBlockedUsers, unblockUser, displayName } from '../src/utils/friends';

export default function BlockedUsers() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setBusy(false); return; }
    setBusy(true);
    try {
      const data = await listBlockedUsers(user.id);
      setRows(data);
    } catch (e) {
      console.log('blocked load error', e);
    } finally {
      setBusy(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmUnblock = (row: any) => {
    const name = displayName(row.profile || {}) || 'this user';
    Alert.alert('Unblock ' + name + '?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          if (!user) return;
          const err = await unblockUser(user.id, row.blocked_id);
          if (err) { Alert.alert('Failed', err); return; }
          setRows((prev) => prev.filter((r) => r.blocked_id !== row.blocked_id));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>PRIVACY</Text>
          <Text style={styles.brand}>Blocked Users</Text>
        </View>
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>X</Text>
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptySub}>
            Users you block will appear here. You can unblock them anytime.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.blocked_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const p = item.profile || {};
            const name = displayName(p) || 'User';
            const avatar = p.avatar_url as string | undefined;
            return (
              <View style={styles.row}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {p.email || ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmUnblock(item)}
                  style={styles.unblockBtn}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
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
    header: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md,
      borderBottomWidth: 1, borderBottomColor: palette.border,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
    },
    backText: { fontSize: 26, color: palette.neon, lineHeight: 28 },
    kicker: { ...typography.micro, color: palette.neon },
    brand: { fontSize: 24, fontWeight: '900', color: palette.text, marginTop: 2 },
    center: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: spacing.xl, gap: spacing.md,
    },
    emptyIcon: {
      fontSize: 64, fontWeight: '900',
      color: palette.neonSoft, marginBottom: spacing.md,
    },
    emptyTitle: { ...typography.heading, color: palette.text },
    emptySub: {
      ...typography.body, color: palette.textMuted,
      textAlign: 'center', marginTop: 6, lineHeight: 22,
    },
    list: { padding: spacing.lg },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      marginBottom: spacing.sm,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarFallback: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: palette.neonSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '900', color: palette.neon },
    name: { ...typography.body, fontWeight: '700', color: palette.text },
    email: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
    unblockBtn: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1, borderColor: palette.neon,
    },
    unblockText: { fontSize: 12, fontWeight: '800', color: palette.neon, letterSpacing: 0.5 },
  });
