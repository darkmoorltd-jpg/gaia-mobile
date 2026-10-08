import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, RefreshControl, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

function fmt(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' +
    d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function CourseLive() {
  const router = useRouter();
  const params = useLocalSearchParams<{ course?: string }>();
  const courseId = params.course;
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [cohorts, setCohorts] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');

  const load = useCallback(async () => {
    if (!courseId || !user) return;
    setBusy(true);
    try {
      const [c, t] = await Promise.all([
        supabase.rpc('univ_cohorts_for', { p_course_id: courseId }),
        supabase.from('courses').select('title,emoji').eq('id', courseId).maybeSingle(),
      ]);
      setCohorts(c.data || []);
      setCourseTitle((t.data?.emoji || '') + ' ' + (t.data?.title || ''));
    } catch (e) { console.log(e); }
    setBusy(false);
    setRef(false);
  }, [courseId, user]);

  useEffect(() => { load(); }, [load]);

  const register = async (c: any) => {
    const { error } = await supabase.rpc('univ_cohort_register', { p_cohort_id: c.id });
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Registered', 'You will be reminded before the class.');
    load();
  };

  const joinLive = (c: any) => {
    if (!c.meeting_room_id) { Alert.alert('No room', 'This session has no Meet room.'); return; }
    router.push(('/meet-room?room=' + c.meeting_room_id) as any);
  };

  const isLiveNow = (c: any) => {
    const sched = new Date(c.scheduled_for).getTime();
    const now = Date.now();
    const dur = (c.duration_minutes || 60) * 60000;
    return now >= sched - 5 * 60000 && now <= sched + dur + 15 * 60000 && c.status === 'scheduled';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>LIVE CLASSES</Text>
        <Text style={styles.title} numberOfLines={1}>{courseTitle || 'Cohorts'}</Text>
        <Text style={styles.sub}>{cohorts.filter((c) => c.status === 'scheduled').length} upcoming sessions</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {cohorts.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No scheduled classes</Text>
            <Text style={styles.emptyText}>
              Live classes are scheduled by GAIA admins and extension officers. You'll see them here once posted.
            </Text>
          </View>
        ) : null}

        {cohorts.map((c) => {
          const live = isLiveNow(c);
          const past = new Date(c.scheduled_for).getTime() < Date.now();
          const cancelled = c.status === 'cancelled';

          return (
            <View key={c.id} style={[styles.card, live && { borderColor: '#ff3b5c', borderWidth: 2 }]}>
              {live ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE NOW</Text>
                </View>
              ) : cancelled ? (
                <Text style={styles.cancelledBadge}>CANCELLED</Text>
              ) : null}

              <Text style={styles.cardTitle}>{c.title}</Text>
              {c.description ? <Text style={styles.cardDesc}>{c.description}</Text> : null}

              <View style={styles.metaRow}>
                <Text style={styles.meta}>📅 {fmt(c.scheduled_for)}</Text>
                <Text style={styles.meta}>⏱ {c.duration_minutes} min</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>👥 {c.attendees}/{c.max_attendees} registered</Text>
                {c.host_email ? <Text style={styles.meta}>Host: {c.host_email.split('@')[0]}</Text> : null}
              </View>

              {!past && !cancelled ? (
                <View style={styles.actionRow}>
                  {c.registered ? (
                    <View style={[styles.miniBtn, { borderColor: '#00ff88' }]}>
                      <Text style={[styles.miniBtnText, { color: '#00ff88' }]}>✓ REGISTERED</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => register(c)} style={[styles.miniBtn, { borderColor: palette.neon }]}>
                      <Text style={[styles.miniBtnText, { color: palette.neon }]}>REGISTER</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => joinLive(c)} style={[styles.miniBtn, live && { backgroundColor: '#ff3b5c', borderColor: '#ff3b5c' }]}>
                    <Text style={[styles.miniBtnText, live ? { color: '#fff' } : { color: palette.text }]}>
                      {live ? 'JOIN LIVE' : 'OPEN ROOM'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {c.replay_url ? (
                <Pressable onPress={() => Share.share({ message: 'Replay: ' + c.replay_url })} style={[styles.miniBtn, { borderColor: '#4fc3f7', marginTop: 8 }]}>
                  <Text style={[styles.miniBtnText, { color: '#4fc3f7' }]}>WATCH REPLAY</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  empty: { padding: 30, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: p.text, marginBottom: 6 },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center', lineHeight: 18 },
  card: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,59,92,0.15)', marginBottom: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b5c' },
  liveText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#ff3b5c' },
  cancelledBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#888', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: p.text, marginBottom: 6 },
  cardDesc: { fontSize: 12, color: p.textMuted, lineHeight: 17, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  meta: { fontSize: 11, color: p.textMuted },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  miniBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: p.text },
});
