
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Screen, Pill } from '../src/components';
import { palette, typography, spacing, radius } from '../src/theme';

const CHATS = [
  { emoji: '👥', name: 'Farmers Lagos Group', msg: 'Yes, the rain is here…', time: '2m', unread: 3, online: true },
  { emoji: '👤', name: 'Musa Ibrahim', msg: 'Thanks for the advice!', time: '15m', unread: 0, online: true },
  { emoji: '👤', name: 'Fatima Bello', msg: 'See you at the market', time: '1h', unread: 0, online: false },
  { emoji: '👥', name: 'Maize Growers NG', msg: '[Image]', time: '3h', unread: 5, online: true },
  { emoji: '👤', name: 'John Okoro', msg: 'Voice message', time: 'yesterday', unread: 0, online: false },
];

export default function Chat() {
  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Community" />
        <Text style={styles.title}>Chat</Text>

        <View style={styles.search}>
          <Text>🔍</Text>
          <Text style={styles.searchText}>Search messages…</Text>
        </View>

        {CHATS.map((c, i) => (
          <Pressable key={i} style={styles.row}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarEmoji}>{c.emoji}</Text>
              {c.online && <View style={styles.onlineDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.msg} numberOfLines={1}>{c.msg}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={styles.time}>{c.time}</Text>
              {c.unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{c.unread}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm, marginBottom: spacing.lg },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  searchText: { color: palette.textDim, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: palette.surface, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: palette.border,
  },
  avatarWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: palette.abyss, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarEmoji: { fontSize: 22 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: palette.neon, borderWidth: 2, borderColor: palette.obsidian,
  },
  name: { ...typography.body, color: palette.text, fontWeight: '700' },
  msg: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
  time: { ...typography.micro, color: palette.textDim },
  badge: { backgroundColor: palette.neon, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#000', fontSize: 10, fontWeight: '900' },
});
