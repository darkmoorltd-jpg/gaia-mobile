import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface CallRow {
  id: string;
  room_id: string;
  mode: string;
  status: string;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  direction: string;
  peer_id: string;
  peer_name: string | null;
  peer_avatar: string | null;
}

function relative(iso: string) {
  try {
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return d.toLocaleDateString();
  } catch { return ''; }
}

function fmtDuration(sec: number) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + 'm ' + (s < 10 ? '0' + s : String(s)) + 's';
}

export default function CallHistory() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [rows, setRows] = useState<CallRow[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('list_call_history', { p_limit: 100 });
      if (!error) setRows(data || []);
    } catch {}
    finally { setBusy(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const callBack = (row: CallRow) => {
    router.push(('/call?room=' + row.room_id + '&peer=' + row.peer_id + '&name=' + encodeURIComponent(row.peer_name || 'Caller') + '&mode=' + row.mode) as any);
  };

  const clearHistory = () => {
    Alert.alert('Clear call history?', 'Ended, rejected, and missed calls will be hidden.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await supabase.rpc('clear_call_history');
        setRows([]);
      }},
    ]);
  };

  const iconFor = (row: CallRow) => {
    if (row.status === 'rejected') return 'REJ';
    if (row.status === 'missed' || (row.direction === 'incoming' && !row.answered_at)) return 'MISS';
    if (row.direction === 'outgoing') return 'OUT';
    return 'IN';
  };
  const colorFor = (row: CallRow) => {
    if (row.status === 'rejected') return palette.danger;
    if (row.status === 'missed' || (row.direction === 'incoming' && !row.answered_at)) return palette.danger;
    if (row.direction === 'outgoing') return palette.neon;
    return palette.neon;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>{'<'}</Text></Pressable>
          <Text style={styles.title}>Calls</Text>
          <Pressable onPress={clearHistory} style={styles.clearBtn}><Text style={styles.clearTxt}>Clear</Text></Pressable>
        </View>

        {busy ? (
          <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No calls yet</Text>
            <Text style={styles.emptySub}>Start a voice or video call from any chat.</Text>
          </View>
        ) : (
          rows.map((row) => (
            <Pressable key={row.id} onPress={() => callBack(row)} style={styles.row}>
              {row.peer_avatar ? (
                <Image source={{ uri: row.peer_avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,255,136,0.15)' }]}>
                  <Text style={{ color: '#00ff88', fontWeight: '900', fontSize: 18 }}>{String(row.peer_name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{row.peer_name || 'Unknown'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Text style={[styles.tag, { color: colorFor(row) }]}>{iconFor(row)}</Text>
                  <Text style={styles.meta}>{row.mode === 'video' ? 'Video' : 'Voice'}  ·  {relative(row.created_at)}</Text>
                  {row.duration_seconds > 0 ? <Text style={styles.meta}>  ·  {fmtDuration(row.duration_seconds)}</Text> : null}
                </View>
              </View>
              <Text style={styles.callIcon}>{row.mode === 'video' ? 'VID' : 'TEL'}</Text>
            </Pressable>
          ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  scroll: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#fff', fontWeight: '300', lineHeight: 24 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  clearTxt: { fontSize: 12, fontWeight: '700', color: '#00ff88' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  emptySub: { fontSize: 13, color: '#8696a0', marginTop: 6, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { fontSize: 15, fontWeight: '700', color: '#fff' },
  tag: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 11, color: '#8696a0' },
  callIcon: { fontSize: 10, fontWeight: '900', color: '#8696a0', letterSpacing: 1, paddingLeft: 8 },
});
