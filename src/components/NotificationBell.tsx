import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { useAuth } from '../store/auth';
import { supabase } from '../api/supabase';

export default function NotificationBell({ size = 22 }: { size?: number }) {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const { count: c } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).is('read_at', null);
    setCount(c || 0);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('notif_bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  return (
    <Pressable onPress={() => router.push('/notifications' as any)} style={styles.wrap}>
      <Text style={{ fontSize: size }}>🔔</Text>
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: palette.danger || '#ff3b5c' }]}>
          <Text style={styles.badgeTxt}>{count > 9 ? '9+' : String(count)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 6, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
