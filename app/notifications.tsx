import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Switch, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { sendLocalNotification, getQuietHours } from '../src/utils/pushNotifications';

export default function NotificationsScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [digest, setDigest] = useState<any | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [qhEnabled, setQhEnabled] = useState(true);
  const [qhStart, setQhStart] = useState(21);
  const [qhEnd, setQhEnd] = useState(6);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data: d } = await supabase.rpc('get_weekly_digest');
      setDigest(d);

      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: q } = await supabase
          .from('notification_queue')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(30);
        setQueue(q || []);

        const { data: p } = await supabase
          .from('user_profiles')
          .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
          .eq('user_id', uid)
          .maybeSingle();
        if (p) {
          setQhEnabled(p.quiet_hours_enabled ?? true);
          setQhStart(p.quiet_hours_start ?? 21);
          setQhEnd(p.quiet_hours_end ?? 6);
        }
      }
    } catch {}
    setBusy(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveQuietHours = async (enabled: boolean, start: number, end: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      await supabase
        .from('user_profiles')
        .update({
          quiet_hours_enabled: enabled,
          quiet_hours_start: start,
          quiet_hours_end: end,
        })
        .eq('user_id', uid);
    } catch {}
  };

  const testPush = async () => {
    await sendLocalNotification(
      'GAIA test',
      'If you see this, push notifications work on your phone.',
      { screen: '/(tabs)/index', type: 'test' },
      'alerts',
    );
  };

  const hourLabel = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hh}:00 ${suffix}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.sub}>Your weekly digest and alerts</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {/* DIGEST CARD */}
        {digest ? (
          <View style={styles.digestCard}>
            <Text style={styles.digestKicker}>THIS WEEK</Text>
            <Text style={styles.digestTitle}>Your farm summary</Text>
            <View style={styles.digestGrid}>
              <DigestStat label="SCANS" value={digest.scans} styles={styles} />
              <DigestStat label="DISEASE HITS" value={digest.disease_hits} styles={styles} accent={palette.danger} />
              <DigestStat label="REVENUE" value={`₦${Math.round(digest.revenue_ngn || 0).toLocaleString()}`} styles={styles} accent={palette.neon} />
              <DigestStat label="OPEN ALERTS" value={digest.alerts_open} styles={styles} accent={palette.warning} />
            </View>
          </View>
        ) : null}

        {/* QUIET HOURS */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.cardTitle}>Quiet hours</Text>
            <Switch
              value={qhEnabled}
              onValueChange={(v) => { setQhEnabled(v); saveQuietHours(v, qhStart, qhEnd); }}
              trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
              thumbColor={qhEnabled ? palette.neon : palette.textDim}
            />
          </View>
          <Text style={styles.cardMeta}>
            No push between {hourLabel(qhStart)} and {hourLabel(qhEnd)}.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <HourStepper label="Start" value={qhStart} onChange={(v) => { setQhStart(v); saveQuietHours(qhEnabled, v, qhEnd); }} />
            <HourStepper label="End" value={qhEnd} onChange={(v) => { setQhEnd(v); saveQuietHours(qhEnabled, qhStart, v); }} />
          </View>
        </View>

        {/* TEST PUSH */}
        <Pressable onPress={testPush} style={styles.testBtn}>
          <Text style={styles.testTxt}>Send test notification</Text>
        </Pressable>

        {/* QUEUE */}
        <Text style={styles.sectionLabel}>RECENT ALERTS ({queue.length})</Text>
        {queue.length === 0 ? (
          <Text style={styles.empty}>No alerts yet.</Text>
        ) : (
          queue.map((q) => (
            <View key={q.id} style={styles.alertCard}>
              <Text style={styles.alertTitle}>{q.title}</Text>
              <Text style={styles.alertBody}>{q.body}</Text>
              <Text style={styles.alertMeta}>{new Date(q.created_at).toLocaleString()} · {q.sent ? 'sent' : 'queued'}</Text>
            </View>
          ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function DigestStat({ label, value, styles, accent }: any) {
  return (
    <View style={styles.digestStat}>
      <Text style={[styles.digestStatVal, accent && { color: accent }]}>{value}</Text>
      <Text style={styles.digestStatLabel}>{label}</Text>
    </View>
  );
}

function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { palette } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface, borderRadius: 10, borderWidth: 1, borderColor: palette.border, padding: 8 }}>
      <Text style={{ fontSize: 10, color: palette.textMuted, fontWeight: '700', width: 34 }}>{label.toUpperCase()}</Text>
      <Pressable onPress={() => onChange((value - 1 + 24) % 24)} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: palette.border, borderRadius: 6 }}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>−</Text>
      </Pressable>
      <Text style={{ flex: 1, textAlign: 'center', color: palette.text, fontWeight: '800' }}>{value}:00</Text>
      <Pressable onPress={() => onChange((value + 1) % 24)} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: palette.border, borderRadius: 6 }}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>+</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  digestCard: { backgroundColor: p.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  digestKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon, marginBottom: 4 },
  digestTitle: { fontSize: 18, fontWeight: '900', color: p.text, marginBottom: 14 },
  digestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  digestStat: { width: '47%', padding: 12, backgroundColor: 'rgba(0,255,136,0.05)', borderRadius: 12, borderWidth: 1, borderColor: p.border },
  digestStatVal: { fontSize: 22, fontWeight: '900', color: p.text },
  digestStatLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 4 },
  card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 12, color: p.textMuted, marginTop: 6 },
  testBtn: { padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center', marginBottom: 24 },
  testTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginBottom: 10 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  alertCard: { backgroundColor: p.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  alertBody: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  alertMeta: { fontSize: 10, color: p.textDim, marginTop: 6 },
});
