import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

export default function Notifications() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setRows(data || []);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel('notif-' + user.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + user.id },
        (payload: any) => setRows((r) => [payload.new, ...r]),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user]));

  const markRead = async (id: number) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, read: true } : x)));
  };

  const unread = rows.filter((r) => !r.read).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>INBOX {unread > 0 ? '(' + unread + ' unread)' : ''}</Text>
        <Text style={styles.title}>Notifications</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {!busy && rows.length === 0 ? (
          <Text style={styles.empty}>No notifications yet.</Text>
        ) : null}

        {rows.map((n) => (
          <Pressable key={n.id} onPress={() => markRead(n.id)} style={[styles.card, !n.read && styles.cardUnread]}>
            <Text style={styles.icon}>{n.icon || '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>{n.title}</Text>
              {n.body ? <Text style={styles.bodyText}>{n.body}</Text> : null}
              <Text style={styles.timeText}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            {!n.read && <View style={styles.dot} />}
          </Pressable>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6, marginBottom: 18 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  card: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10, alignItems: 'center' },
  cardUnread: { borderColor: p.borderHi, backgroundColor: p.neonSoft },
  icon: { fontSize: 24 },
  titleText: { fontSize: 14, fontWeight: '800', color: p.text },
  bodyText: { fontSize: 13, color: p.textMuted, marginTop: 4, lineHeight: 18 },
  timeText: { fontSize: 10, color: p.textDim, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon },
});
