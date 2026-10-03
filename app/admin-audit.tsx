import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminAudit() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<'audit' | 'logins'>('audit');
  const [audit, setAudit] = useState<any[]>([]);
  const [logins, setLogins] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [a, l] = await Promise.all([
      supabase.rpc('admin_list_audit', { p_limit: 200 }),
      supabase.rpc('admin_list_logins', { p_user_id: null, p_limit: 200 }),
    ]);
    if (!a.error) setAudit(a.data || []);
    if (!l.error) setLogins(l.data || []);
    setBusy(false); setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Audit & Logins</Text>
        <Text style={styles.sub}>{audit.length} admin actions · {logins.length} logins</Text>

        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab('audit')} style={[styles.tabBtn, tab === 'audit' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === 'audit' && styles.tabTextActive]}>Audit Log</Text>
          </Pressable>
          <Pressable onPress={() => setTab('logins')} style={[styles.tabBtn, tab === 'logins' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === 'logins' && styles.tabTextActive]}>Login History</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {tab === 'audit' ? (
          audit.length === 0 ? <Text style={styles.kv}>No actions logged yet.</Text> :
            audit.map((a: any, i: number) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>{(a.action || '').toUpperCase()}</Text>
                <Text style={styles.cardMeta}>By: {a.admin_email || '—'}</Text>
                {a.target_user_id ? <Text style={styles.cardMeta}>Target: {a.target_user_id.slice(0, 12)}…</Text> : null}
                {a.details && Object.keys(a.details).length > 0 ? (
                  <Text style={styles.cardMeta} numberOfLines={2}>{JSON.stringify(a.details)}</Text>
                ) : null}
                <Text style={styles.cardMeta}>{new Date(a.created_at).toLocaleString()}</Text>
              </View>
            ))
        ) : (
          logins.length === 0 ? (
            <Text style={styles.kv}>
              No login history yet. To populate this, the app must insert into login_history on each sign-in
              — patched in the app-side cell below.
            </Text>
          ) :
            logins.map((l: any, i: number) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>{l.email || l.user_id.slice(0, 12)}</Text>
                <Text style={styles.cardMeta}>{l.platform || '—'} · {l.device_model || '—'}</Text>
                <Text style={styles.cardMeta}>IP: {l.ip || '—'}</Text>
                <Text style={styles.cardMeta}>{new Date(l.logged_at).toLocaleString()}</Text>
              </View>
            ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  card: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  kv: { fontSize: 12, color: p.textMuted, lineHeight: 18 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
