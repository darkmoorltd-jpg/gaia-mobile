import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import axios from 'axios';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const API = 'https://gaia-api-xuly.onrender.com';

function isOnline(lastSeen?: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 120_000;
}

export default function AdminUsers() {
  const router = useRouter();
  const { palette } = useTheme();
  const auth: any = useAuth();
  const user = auth.user;
  const session = auth.session;
  const styles = createStyles(palette);

  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return;
    setBusy(true);
    try {
      const [scans, profiles, presence] = await Promise.all([
        supabase.from('user_scans').select('*').limit(500),
        supabase.from('user_profiles').select('*').limit(500),
        supabase.from('user_presence').select('*').limit(500),
      ]);
      const pMap: Record<string, any> = {};
      (profiles.data || []).forEach((p: any) => { pMap[p.user_id] = p; });
      const prMap: Record<string, any> = {};
      (presence.data || []).forEach((p: any) => { prMap[p.user_id] = p; });
      const merged = (scans.data || []).map((s: any) => ({
        ...s,
        profile: pMap[s.user_id] || {},
        presence: prMap[s.user_id] || {},
      }));
      setRows(merged);
    } catch {}
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: refresh on any presence change
  useEffect(() => {
    const channel = supabase
      .channel('admin-presence-live')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'user_presence' },
          () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const hdr = session?.access_token
    ? { Authorization: 'Bearer ' + session.access_token }
    : {};

  const resetPassword = (uid: string) => {
    Alert.prompt('Reset password', 'New password (min 6 chars)', async (pw?: string) => {
      if (!pw || pw.length < 6) return;
      setActionBusy(true);
      try {
        const fd = new FormData();
        fd.append('user_id', uid);
        fd.append('new_password', pw);
        await axios.post(API + '/admin/reset-password', fd, { headers: hdr as any });
        Alert.alert('Done', 'Password reset');
      } catch (e: any) {
        Alert.alert('Failed', e?.response?.data?.detail || e?.message || 'error');
      } finally { setActionBusy(false); }
    });
  };

  const changeScans = (uid: string) => {
    Alert.prompt('Add / remove scans', 'Enter amount (negative to remove)', async (v?: string) => {
      const delta = Number(v);
      if (!Number.isFinite(delta) || delta === 0) return;
      setActionBusy(true);
      try {
        const fd = new FormData();
        fd.append('user_id', uid);
        fd.append('delta', String(delta));
        fd.append('reason', 'admin adjustment');
        const r = await axios.post(API + '/admin/add-scans', fd, { headers: hdr as any });
        Alert.alert('Updated', 'New total: ' + r.data.new_total);
        load();
      } catch (e: any) {
        Alert.alert('Failed', e?.response?.data?.detail || e?.message || 'error');
      } finally { setActionBusy(false); }
    });
  };

  const banUser = (uid: string) => {
    Alert.alert('Ban user?', '24-hour ban. Reversible.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Ban 24h', style: 'destructive', onPress: async () => {
        setActionBusy(true);
        try {
          const fd = new FormData();
          fd.append('user_id', uid);
          fd.append('ban_hours', '24');
          await axios.post(API + '/admin/ban-user', fd, { headers: hdr as any });
          Alert.alert('Banned', 'User blocked for 24 hours');
        } catch (e: any) {
          Alert.alert('Failed', e?.response?.data?.detail || e?.message || 'error');
        } finally { setActionBusy(false); }
      }},
    ]);
  };

  const deleteUser = (uid: string) => {
    Alert.alert('Delete user?', 'Permanently removes account + all data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setActionBusy(true);
        try {
          await axios.delete(API + '/admin/delete-user/' + uid, { headers: hdr as any });
          Alert.alert('Deleted');
          setSelected(null);
          load();
        } catch (e: any) {
          Alert.alert('Failed', e?.response?.data?.detail || e?.message || 'error');
        } finally { setActionBusy(false); }
      }},
    ]);
  };

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const filtered = search.trim()
    ? rows.filter((r) => {
        const p = r.profile || {};
        const hay = ((p.email || '') + ' ' + (p.first_name || '') + ' ' + (p.last_name || '') + ' ' + (p.state || '')).toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : rows;

  const onlineCount = rows.filter((r) => isOnline(r.presence?.last_seen)).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.sub}>
          {rows.length} total · <Text style={{ color: palette.neon }}>{onlineCount} online</Text>
        </Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search users…"
            placeholderTextColor={palette.textDim}
            style={styles.search}
          />
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {filtered.map((r, i) => {
          const p = r.profile || {};
          const online = isOnline(r.presence?.last_seen);
          const name = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || 'Farmer';
          return (
            <Pressable key={i} onPress={() => setSelected(r)} style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(name[0] || 'F').toUpperCase()}</Text>
                {online ? <View style={styles.dot} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.email} numberOfLines={1}>{p.email || (r.user_id || '').slice(0, 16)}</Text>
                <View style={styles.metaRow}>
                  {p.state ? <Text style={styles.meta}>📍 {p.state}</Text> : null}
                  <Text style={styles.meta}>📉 {r.scans_remaining}</Text>
                  <Text style={styles.meta}>{(r.plan || 'free').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.back}>CLOSE</Text>
              </Pressable>

              <Text style={styles.title}>
                {(selected?.profile?.first_name || 'User')} {(selected?.profile?.last_name || '')}
              </Text>
              <Text style={styles.sub}>{selected?.profile?.email}</Text>

              <Text style={styles.sectionLabel}>PROFILE</Text>
              <Text style={styles.kv}><Text style={styles.k}>Phone: </Text>{selected?.profile?.phone || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>State: </Text>{selected?.profile?.state || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>LGA: </Text>{selected?.profile?.lga || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Crops: </Text>{selected?.profile?.crop || '—'}</Text>

              <Text style={styles.sectionLabel}>PRESENCE</Text>
              <Text style={styles.kv}>
                <Text style={styles.k}>Last seen: </Text>
                {selected?.presence?.last_seen ? new Date(selected.presence.last_seen).toLocaleString() : 'never'}
              </Text>
              <Text style={styles.kv}><Text style={styles.k}>Platform: </Text>{selected?.presence?.platform || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Device: </Text>{selected?.presence?.device_model || '—'}</Text>
              <Text style={styles.kv}>
                <Text style={styles.k}>GPS: </Text>
                {selected?.presence?.lat ? selected.presence.lat.toFixed(4) + ', ' + selected.presence.lon.toFixed(4) : '—'}
              </Text>

              <Text style={styles.sectionLabel}>ACCOUNT</Text>
              <Text style={styles.kv}><Text style={styles.k}>Plan: </Text>{(selected?.plan || 'free').toUpperCase()}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Scans remaining: </Text>{selected?.scans_remaining}</Text>
              <Text style={styles.kv}><Text style={styles.k}>User ID: </Text>{(selected?.user_id || '').slice(0, 20)}…</Text>

              <Text style={styles.sectionLabel}>ACTIONS</Text>
              <Pressable disabled={actionBusy} onPress={() => resetPassword(selected.user_id)} style={styles.actionBtn}>
                <Text style={styles.actionTxt}>RESET PASSWORD</Text>
              </Pressable>
              <Pressable disabled={actionBusy} onPress={() => changeScans(selected.user_id)} style={styles.actionBtn}>
                <Text style={styles.actionTxt}>ADD / REMOVE SCANS</Text>
              </Pressable>
              <Pressable disabled={actionBusy} onPress={() => banUser(selected.user_id)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                <Text style={[styles.actionTxt, { color: palette.warning }]}>BAN FOR 24H</Text>
              </Pressable>
              <Pressable disabled={actionBusy} onPress={() => deleteUser(selected.user_id)} style={[styles.actionBtn, { borderColor: palette.danger }]}>
                <Text style={[styles.actionTxt, { color: palette.danger }]}>DELETE USER</Text>
              </Pressable>

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  searchWrap: {
    backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 14,
    marginBottom: 16, borderWidth: 1, borderColor: p.border,
  },
  search: { paddingVertical: 12, color: p.text, fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, backgroundColor: p.surface,
    marginBottom: 8, borderWidth: 1, borderColor: p.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarTxt: { fontSize: 20, fontWeight: '900', color: p.neon },
  dot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: p.neon, borderWidth: 2, borderColor: p.obsidian,
  },
  name: { fontSize: 15, fontWeight: '700', color: p.text },
  email: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  meta: { fontSize: 11, color: p.textMuted },
  chevron: { fontSize: 22, color: p.textDim },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: p.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '88%',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    color: p.textMuted, marginTop: 20, marginBottom: 8,
  },
  kv: { fontSize: 13, color: p.text, marginBottom: 6 },
  k: { color: p.neon, fontWeight: '700' },
  actionBtn: {
    padding: 16, borderRadius: 12, borderWidth: 1.5,
    borderColor: p.borderHi, alignItems: 'center', marginTop: 10,
  },
  actionTxt: { fontSize: 13, fontWeight: '800', color: p.neon, letterSpacing: 1 },
});
