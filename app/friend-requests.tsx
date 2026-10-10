import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Image, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface Request {
  id: number;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  profile: any;
}

function timeAgo(iso: string) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(iso).toLocaleDateString();
}

function displayName(p: any) {
  const n = ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
  return n || (p.email ? p.email.split('@')[0] : 'Farmer');
}

export default function FriendRequests() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [received, setReceived] = useState<Request[]>([]);
  const [sent, setSent] = useState<Request[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: recv } = await supabase
        .from('friendships').select('*')
        .eq('receiver_id', user.id).eq('status', 'pending')
        .order('created_at', { ascending: false });

      const { data: sentRows } = await supabase
        .from('friendships').select('*')
        .eq('sender_id', user.id).eq('status', 'pending')
        .order('created_at', { ascending: false });

      const ids: string[] = [
        ...((recv || []).map((r: any) => r.sender_id)),
        ...((sentRows || []).map((r: any) => r.receiver_id)),
      ];

      const profileMap: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('user_id,email,first_name,last_name,avatar_url,state,lga,primary_crops,farm_size_acres,verification_status')
          .in('user_id', ids);
        (profs || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      }

      setReceived((recv || []).map((r: any) => ({ ...r, profile: profileMap[r.sender_id] || {} })));
      setSent((sentRows || []).map((r: any) => ({ ...r, profile: profileMap[r.receiver_id] || {} })));
    } catch (e) {
      console.log('friend-requests load error', e);
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('fr-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const accept = async (req: Request) => {
    setActionId(req.id);
    try {
      const { error } = await supabase.from('friendships')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;
      setReceived((prev) => prev.filter((r) => r.id !== req.id));
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Try again');
    } finally { setActionId(null); }
  };

  const decline = (req: Request) => {
    Alert.alert('Decline?', 'Remove this request.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: async () => {
        setActionId(req.id);
        try {
          const { error } = await supabase.from('friendships').delete().eq('id', req.id);
          if (error) throw error;
          setReceived((prev) => prev.filter((r) => r.id !== req.id));
        } catch (e: any) {
          Alert.alert('Failed', e?.message || 'Try again');
        } finally { setActionId(null); }
      }},
    ]);
  };

  const cancel = (req: Request) => {
    Alert.alert('Cancel request?', '', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: async () => {
        setActionId(req.id);
        try {
          const { error } = await supabase.from('friendships').delete().eq('id', req.id);
          if (error) throw error;
          setSent((prev) => prev.filter((r) => r.id !== req.id));
        } catch (e: any) {
          Alert.alert('Failed', e?.message || 'Try again');
        } finally { setActionId(null); }
      }},
    ]);
  };

  const list = tab === 'received' ? received : sent;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>FRIENDS</Text>
          <Text style={styles.title}>Requests</Text>
        </View>
        <Pressable onPress={() => router.push('/add-friend' as any)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['received', 'sent'] as const).map((t) => {
          const on = tab === t;
          const count = t === 'received' ? received.length : sent.length;
          const label = t === 'received' ? 'Received' : 'Sent';
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {label}{count > 0 ? ' (' + count + ')' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {busy ? (
        <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
        >
          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {tab === 'received' ? 'No incoming requests' : 'No sent requests'}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'received'
                  ? 'When someone adds you, they will appear here.'
                  : 'Find farmers to connect with.'}
              </Text>
            </View>
          ) : list.map((req) => {
            const p = req.profile || {};
            const name = displayName(p);
            const busyThis = actionId === req.id;
            return (
              <View key={req.id} style={styles.card}>
                <View style={styles.cardTop}>
                  {p.avatar_url ? (
                    <Image source={{ uri: p.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{name}</Text>
                      {p.verification_status === 'approved' ? (
                        <View style={styles.verifiedChip}>
                          <Text style={styles.verifiedText}>VERIFIED</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[p.state, p.lga].filter(Boolean).join(' · ') || 'Location unknown'}
                    </Text>
                    {p.primary_crops ? (
                      <Text style={styles.meta} numberOfLines={1}>
                        {p.primary_crops}
                        {p.farm_size_acres ? ' · ' + p.farm_size_acres + ' acres' : ''}
                      </Text>
                    ) : null}
                    <Text style={styles.time}>{timeAgo(req.created_at)}</Text>
                  </View>
                </View>

                {tab === 'received' ? (
                  <View style={styles.actions}>
                    <Pressable
                      disabled={busyThis}
                      onPress={() => accept(req)}
                      style={[styles.actionPrimary, busyThis && { opacity: 0.5 }]}
                    >
                      {busyThis ? (
                        <ActivityIndicator color={palette.obsidian} size="small" />
                      ) : (
                        <Text style={styles.actionPrimaryText}>ACCEPT</Text>
                      )}
                    </Pressable>
                    <Pressable
                      disabled={busyThis}
                      onPress={() => decline(req)}
                      style={[styles.actionSecondary, busyThis && { opacity: 0.5 }]}
                    >
                      <Text style={styles.actionSecondaryText}>DECLINE</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      disabled={busyThis}
                      onPress={() => cancel(req)}
                      style={[styles.actionSecondary, { flex: 1 }, busyThis && { opacity: 0.5 }]}
                    >
                      <Text style={styles.actionSecondaryText}>CANCEL REQUEST</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -0.5, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: p.neon, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 24, fontWeight: '900', color: p.obsidian, lineHeight: 26 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  tab: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: p.border, backgroundColor: p.surface,
    alignItems: 'center',
  },
  tabOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.1)' },
  tabText: { fontSize: 12, fontWeight: '800', color: p.textMuted, letterSpacing: 0.5 },
  tabTextOn: { color: p.neon },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  empty: { paddingVertical: 80, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: p.text },
  emptySub: { fontSize: 12, color: p.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
  card: {
    padding: 16, borderRadius: 18,
    backgroundColor: p.surface, marginBottom: 12,
    borderWidth: 1, borderColor: p.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: p.borderHi,
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: p.neon },
  cardBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '800', color: p.text, flexShrink: 1 },
  verifiedChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(0,255,136,0.15)',
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.4)',
  },
  verifiedText: { fontSize: 8, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  time: { fontSize: 10, color: p.textDim, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionPrimary: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: p.neon, alignItems: 'center', justifyContent: 'center',
  },
  actionPrimaryText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  actionSecondary: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  actionSecondaryText: { fontSize: 12, fontWeight: '900', color: p.text, letterSpacing: 1 },
});
