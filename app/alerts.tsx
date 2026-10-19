import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';

const TYPE_LABEL: Record<string, string> = {
  crops: 'Crop', pests: 'Pest', soil: 'Soil', livestock: 'Livestock', video: 'Video',
};
const SEVERITY_COLOR: Record<string, string> = {
  high: '#ff3b5c', moderate: '#ffb300', low: '#00ff88',
};
const TYPE_ROUTE: Record<string, string> = {
  crops: '/(tabs)/crops', pests: '/(tabs)/pests', soil: '/(tabs)/soil',
  livestock: '/(tabs)/livestock', video: '/video-scan',
};

export default function Alerts() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [tab, setTab] = useState<'alerts' | 'followups'>('alerts');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
      const since5 = new Date(Date.now() - 5 * 86400000).toISOString();

      const [alertsRes, candsRes, linksRes] = await Promise.all([
        supabase.rpc('user_my_alerts'),
        supabase
          .from('scan_history')
          .select('id, top_label, type, confidence, image_url, created_at')
          .not('top_label', 'is', null)
          .not('top_label', 'ilike', '%healthy%')
          .gte('created_at', since14)
          .lte('created_at', since5)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('scan_history')
          .select('follow_up_of')
          .not('follow_up_of', 'is', null),
      ]);

      if (!alertsRes.error) setAlerts(alertsRes.data || []);

      const followed = new Set<string>(
        (linksRes.data || []).map((x: any) => x.follow_up_of).filter(Boolean)
      );

      const list = (candsRes.data || [])
        .filter((x: any) => !followed.has(x.id))
        .map((x: any) => ({
          ...x,
          days_ago: Math.max(0, Math.floor((Date.now() - new Date(x.created_at).getTime()) / 86400000)),
        }));

      setFollowups(list);
    } catch (e) { console.warn(e); }
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Alerts & Follow-ups</Text>
        <Text style={styles.sub}>{alerts.length} alerts · {followups.length} follow-ups pending</Text>

        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab('alerts')} style={[styles.tabBtn, tab === 'alerts' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'alerts' && styles.tabTextOn]}>ALERTS</Text>
          </Pressable>
          <Pressable onPress={() => setTab('followups')} style={[styles.tabBtn, tab === 'followups' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'followups' && styles.tabTextOn]}>FOLLOW-UPS</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {tab === 'alerts' ? (
          alerts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No active alerts</Text>
              <Text style={styles.emptyText}>When diseases cluster in your area, you will see them here.</Text>
            </View>
          ) : alerts.map((a, i) => {
            const color = SEVERITY_COLOR[a.severity] || palette.neon;
            return (
              <View key={i} style={[styles.alertCard, { borderLeftColor: color }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.alertLabel}>{a.disease}</Text>
                  <Text style={[styles.alertSev, { color }]}>{(a.severity || '').toUpperCase()}</Text>
                </View>
                <Text style={styles.alertMeta}>{TYPE_LABEL[a.type] || a.type} · {a.state}</Text>
                <Text style={styles.alertStat}>
                  {a.farmer_count} farmer{a.farmer_count === 1 ? '' : 's'} · {a.scan_count} scan{a.scan_count === 1 ? '' : 's'} this week
                </Text>
              </View>
            );
          })
        ) : null}

        {tab === 'followups' ? (
          followups.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptyText}>Diseased scans older than 5 days with no follow-up will appear here.</Text>
            </View>
          ) : followups.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => router.push((TYPE_ROUTE[f.type] || '/(tabs)/crops') as any)}
              style={styles.followupCard}
            >
              {f.image_url ? (
                <Image source={{ uri: f.image_url }} style={styles.followupThumb} />
              ) : (
                <View style={[styles.followupThumb, styles.followupThumbEmpty]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.followupLabel}>{f.top_label}</Text>
                <Text style={styles.followupMeta}>
                  {TYPE_LABEL[f.type] || f.type} · Scanned {f.days_ago} day{f.days_ago === 1 ? '' : 's'} ago
                </Text>
                <Text style={styles.followupAction}>Tap to re-scan →</Text>
              </View>
            </Pressable>
          ))
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 10, fontWeight: '800', color: p.textDim, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyTitle: { ...typography.heading, color: p.text, marginBottom: 8 },
  emptyText: { ...typography.body, color: p.textMuted, textAlign: 'center', lineHeight: 20 },
  alertCard: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderLeftWidth: 4, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  alertLabel: { fontSize: 15, fontWeight: '800', color: p.text },
  alertSev: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  alertMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  alertStat: { fontSize: 11, color: p.neon, marginTop: 4, fontWeight: '700' },
  followupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  followupThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.2)' },
  followupThumbEmpty: {},
  followupLabel: { fontSize: 14, fontWeight: '700', color: p.text },
  followupMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  followupAction: { fontSize: 11, color: p.neon, marginTop: 4, fontWeight: '700' },
});
