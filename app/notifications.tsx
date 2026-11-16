import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function NotificationsScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
    setBusy(false);
  }, [user]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('notif_screen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, read_at: new Date().toISOString() } : r));
  };
  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    await load();
  };
  const openNotif = async (n: any) => {
    if (!n.read_at) await markRead(n.id);
    const route = n.data?.route;
    if (route) router.push(route as any);
  };

  const unread = rows.filter(r => !r.read_at).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.title}>Notifications</Text>
          {unread > 0 ? <Pressable onPress={markAllRead}><Text style={styles.markAll}>MARK ALL READ</Text></Pressable> : null}
        </View>
        <Text style={styles.sub}>{unread} unread</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>
        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && rows.length === 0 ? <Text style={styles.empty}>No notifications yet.</Text> : null}
        {rows.map(n => (
          <Pressable key={n.id} onPress={() => openNotif(n)} style={[styles.card, !n.read_at && styles.cardUnread]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[styles.title2, !n.read_at && { color: palette.neon }]}>{n.title}</Text>
              {!n.read_at ? <View style={styles.dot} /> : null}
            </View>
            {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
            <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
          </Pressable>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  markAll: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  cardUnread: { borderColor: p.neon },
  title2: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1, paddingRight: 8 },
  body: { fontSize: 13, color: p.text, marginTop: 4, lineHeight: 19 },
  time: { fontSize: 10, color: p.textDim, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon, marginTop: 5 },
});
