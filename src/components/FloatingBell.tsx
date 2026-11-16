import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useAuth } from '../store/auth';
import { supabase } from '../api/supabase';

const HIDE_ON = [
  '/login','/signup','/forgot-password','/onboarding','/country-select',
  '/language-select','/auth-callback','/reset-password','/notifications',
];

export default function FloatingBell() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const [count, setCount] = useState(0);

  const visible = !!user && !HIDE_ON.some(p => pathname === p || pathname.startsWith(p + '/'));

  const load = useCallback(async () => {
    if (!user || !visible) return;
    const { count: c } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).is('read_at', null);
    setCount(c || 0);
  }, [user, visible]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user || !visible) return;
    const ch = supabase.channel('floating_bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, visible, load]);

  if (!visible) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Pressable
        onPress={() => router.push('/notifications' as any)}
        style={[styles.bell, { backgroundColor: palette.surface || '#1a1a1a', borderColor: palette.border || '#333' }]}
      >
        <Text style={{ fontSize: 18 }}>🔔</Text>
        {count > 0 ? (
          <View style={[styles.badge, { backgroundColor: palette.danger || '#ff3b5c' }]}>
            <Text style={styles.badgeTxt}>{count > 9 ? '9+' : String(count)}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 12, zIndex: 999 },
  bell: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
