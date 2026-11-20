import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

export default function MinistryProfile() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const signOut = useAuth((s: any) => s.signOut);
  const [access, setAccess] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.from('ministry_access').select('*').eq('user_id', user?.id).eq('is_active', true).maybeSingle();
    setAccess(data);
    setBusy(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Ministry Account</Text>
        <Text style={styles.sub}>{user?.email}</Text>

        {access ? (
          <View style={styles.card}>
            <Text style={styles.lbl}>LEVEL</Text>
            <Text style={styles.val}>{access.level.toUpperCase()}</Text>
            {access.scope_state ? (<><Text style={styles.lbl}>STATE</Text><Text style={styles.val}>{access.scope_state}</Text></>) : null}
            {access.organization ? (<><Text style={styles.lbl}>ORGANIZATION</Text><Text style={styles.val}>{access.organization}</Text></>) : null}
            <Text style={styles.lbl}>GRANTED</Text>
            <Text style={styles.val}>{new Date(access.granted_at).toLocaleDateString()}</Text>
          </View>
        ) : <Text style={styles.warn}>No ministry access — contact admin.</Text>}

        <Pressable onPress={async () => { await signOut(); router.replace('/(auth)/login'); }} style={styles.logout}>
          <Text style={styles.logoutTxt}>SIGN OUT</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff' },
  sub: { fontSize: 12, color: '#888', marginTop: 4, marginBottom: 24 },
  card: { padding: 20, borderRadius: 16, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  lbl: { fontSize: 10, fontWeight: '800', color: '#00ff88', letterSpacing: 1.5, marginTop: 12 },
  val: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 4 },
  warn: { fontSize: 13, color: '#ffb300', textAlign: 'center', padding: 20 },
  logout: { marginTop: 24, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#ff3b5c', alignItems: 'center' },
  logoutTxt: { fontSize: 12, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
});
