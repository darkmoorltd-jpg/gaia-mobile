import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, Image, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

type Tab = 'overview' | 'radar' | 'review' | 'users';

function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function AdminScans() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>({});
  const [radar, setRadar] = useState<any[]>([]);
  const [review, setReview] = useState<any[]>([]);
  const [userScans, setUserScans] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const [s, r, rev, us] = await Promise.all([
        supabase.rpc('admin_scan_stats', { p_days: 30 }),
        supabase.rpc('admin_outbreak_radar', { p_days: 7 }),
        supabase
          .from('scan_history')
          .select('*')
          .lt('confidence', 60)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('scan_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (!s.error) setStats(s.data || {});
      if (!r.error) setRadar(r.data || []);
      if (!rev.error) setReview(rev.data || []);
      if (!us.error) setUserScans(us.data || []);
    } catch (e) {
      console.warn('admin scans load failed', e);
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const byType = stats.by_type || {};
  const topDiseases = stats.top_diseases || [];
  const topStates = stats.top_states || [];

  const filteredUsers = userSearch.trim()
    ? userScans.filter((s) => {
        const hay = (s.top_label || '') + ' ' + (s.type || '') + ' ' + (s.user_id || '');
        return hay.toLowerCase().includes(userSearch.toLowerCase());
      })
    : userScans;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Scan Dashboard</Text>
        <Text style={styles.sub}>Live diagnostic activity across the platform</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['overview', 'radar', 'review', 'users'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tabBtn, tab === t && styles.tabBtnOn]}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                  {t === 'overview' ? 'OVERVIEW' : t === 'radar' ? 'RADAR' : t === 'review' ? 'REVIEW' : 'LIVE'}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {tab === 'overview' ? (
          <>
            <View style={styles.grid}>
              <Stat label="TOTAL" value={stats.total ?? 0} palette={palette} />
              <Stat label="7D" value={stats.last_7d ?? 0} palette={palette} />
              <Stat label="30D" value={stats.last_30d ?? 0} palette={palette} />
              <Stat label="AVG CONF" value={(stats.avg_confidence ?? 0) + '%'} palette={palette} />
            </View>

            <Text style={styles.sectionLabel}>BY DEVICE</Text>
            <View style={styles.grid}>
              <Stat label="ON-DEVICE" value={stats.on_device_count ?? 0} palette={palette} accent={palette.neon} />
              <Stat label="SERVER" value={stats.server_count ?? 0} palette={palette} />
            </View>

            <Text style={styles.sectionLabel}>BY TYPE</Text>
            {Object.entries(byType).length === 0 ? (
              <Text style={styles.empty}>No scans yet.</Text>
            ) : Object.entries(byType).map(([k, v]: any) => (
              <View key={k} style={styles.barRow}>
                <Text style={styles.barLabel}>{k}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: Math.min(100, (v as number) * 5) + '%' }]} />
                </View>
                <Text style={styles.barVal}>{v}</Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>TOP DISEASES</Text>
            {topDiseases.length === 0 ? <Text style={styles.empty}>No data.</Text> :
              topDiseases.map((d: any, i: number) => (
                <View key={i} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: Math.min(100, d.n * 10) + '%' }]} />
                  </View>
                  <Text style={styles.barVal}>{d.n}</Text>
                </View>
              ))}

            <Text style={styles.sectionLabel}>TOP STATES</Text>
            {topStates.length === 0 ? <Text style={styles.empty}>No location data.</Text> :
              topStates.map((d: any, i: number) => (
                <View key={i} style={styles.barRow}>
                  <Text style={styles.barLabel}>{d.state}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: Math.min(100, d.n * 10) + '%' }]} />
                  </View>
                  <Text style={styles.barVal}>{d.n}</Text>
                </View>
              ))}

            <Text style={styles.sectionLabel}>OUTCOMES</Text>
            <View style={styles.grid}>
              <Stat label="IMPROVED" value={stats.improved ?? 0} palette={palette} accent={palette.neon} />
              <Stat label="WORSENED" value={stats.worsened ?? 0} palette={palette} accent={palette.danger} />
            </View>
          </>
        ) : null}

        {tab === 'radar' ? (
          <>
            <Text style={styles.sectionLabel}>ACTIVE OUTBREAKS (LAST 7 DAYS)</Text>
            {radar.length === 0 ? (
              <Text style={styles.empty}>No clusters detected. Everything looks normal.</Text>
            ) : radar.map((r: any, i: number) => {
              const sev = r.scan_count >= 10 ? 'high' : r.scan_count >= 5 ? 'moderate' : 'low';
              const color = sev === 'high' ? palette.danger : sev === 'moderate' ? palette.warning : palette.neon;
              return (
                <View key={i} style={[styles.alertCard, { borderLeftColor: color }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.alertTitle}>{r.top_label}</Text>
                    <Text style={[styles.alertBadge, { color }]}>{r.scan_count} scans</Text>
                  </View>
                  <Text style={styles.alertMeta}>{r.type} · {r.state}{r.lga ? ' / ' + r.lga : ''}</Text>
                  <Text style={styles.alertMeta}>
                    Avg conf {r.avg_conf}% · Last seen {fmtDate(r.last_seen)}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}

        {tab === 'review' ? (
          <>
            <Text style={styles.sectionLabel}>LOW CONFIDENCE ({review.length})</Text>
            {review.length === 0 ? (
              <Text style={styles.empty}>No low-confidence scans. Models healthy.</Text>
            ) : review.map((s: any) => (
              <Pressable key={s.id} onPress={() => setSelected(s)} style={styles.reviewCard}>
                {s.image_url ? (
                  <Image source={{ uri: s.image_url }} style={styles.reviewThumb} />
                ) : (
                  <View style={[styles.reviewThumb, styles.reviewThumbEmpty]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewTitle} numberOfLines={1}>{s.top_label || '?'}</Text>
                  <Text style={styles.reviewMeta}>{s.type} · {Math.round(s.confidence || 0)}% · {fmtDate(s.created_at)}</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {tab === 'users' ? (
          <>
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Filter by label, type, or user..."
              placeholderTextColor={palette.textDim}
              style={styles.search}
            />
            <Text style={styles.sectionLabel}>RECENT ({filteredUsers.length})</Text>
            {filteredUsers.map((s: any) => (
              <Pressable key={s.id} onPress={() => setSelected(s)} style={styles.reviewCard}>
                {s.image_url ? (
                  <Image source={{ uri: s.image_url }} style={styles.reviewThumb} />
                ) : (
                  <View style={[styles.reviewThumb, styles.reviewThumbEmpty]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewTitle} numberOfLines={1}>{s.top_label || '?'}</Text>
                  <Text style={styles.reviewMeta}>
                    {s.type} · {Math.round(s.confidence || 0)}% · {s.on_device ? 'On-device' : 'Server'}
                  </Text>
                  <Text style={styles.reviewMeta}>{s.user_id?.slice(0, 12)} · {fmtDate(s.created_at)}</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.back}>CLOSE</Text>
              </Pressable>
              <Text style={styles.title}>{selected?.top_label || 'Scan'}</Text>
              <Text style={styles.sub}>
                {selected?.type} · {Math.round(selected?.confidence || 0)}% · {fmtDate(selected?.created_at)}
              </Text>

              {selected?.image_url ? (
                <Image source={{ uri: selected.image_url }} style={styles.modalImage} resizeMode="contain" />
              ) : null}

              <Text style={styles.sectionLabel}>METADATA</Text>
              <Text style={styles.kv}><Text style={styles.k}>User: </Text>{selected?.user_id}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Model: </Text>{selected?.model_key || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>On-device: </Text>{selected?.on_device ? 'Yes' : 'No'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Inference: </Text>{selected?.inference_ms || '—'} ms</Text>
              <Text style={styles.kv}><Text style={styles.k}>GPS: </Text>{selected?.gps_lat && selected?.gps_lon ? selected.gps_lat + ', ' + selected.gps_lon : '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Outcome: </Text>{selected?.outcome || '—'}</Text>

              <Text style={styles.sectionLabel}>PREDICTIONS</Text>
              {(selected?.all_predictions || []).slice(0, 10).map((p: any, i: number) => (
                <View key={i} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>{p.label}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: Math.min(100, p.confidence) + '%' }]} />
                  </View>
                  <Text style={styles.barVal}>{Math.round(p.confidence)}%</Text>
                </View>
              ))}
              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, palette, accent }: any) {
  return (
    <View style={{
      width: '48%', padding: 16, borderRadius: 14,
      backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
      alignItems: 'center',
    }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: accent || palette.neon }} numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: palette.textMuted, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { marginBottom: 16, maxHeight: 44 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  tabText: { fontSize: 10, fontWeight: '800', color: p.textDim, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: p.neon, marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { width: 100, fontSize: 11, color: p.text },
  barBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 3 },
  barVal: { width: 40, fontSize: 11, color: p.textMuted, textAlign: 'right' },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  alertCard: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderLeftWidth: 4, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  alertTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  alertBadge: { fontSize: 11, fontWeight: '900' },
  alertMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  reviewThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.2)' },
  reviewThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  reviewTitle: { fontSize: 13, fontWeight: '700', color: p.text },
  reviewMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  search: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  modalImage: { width: '100%', height: 240, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.2)', marginVertical: 12 },
  kv: { fontSize: 12, color: p.text, marginBottom: 6, lineHeight: 18 },
  k: { color: p.neon, fontWeight: '700' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
