import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, Image, TextInput, Alert, Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { useIsAdmin } from 'src/utils/admin';
import { supabase } from '../src/api/supabase';
import { MarkdownOutput } from '../src/components/MarkdownOutput';
const TYPE_LABEL: Record<string, string> = {
  crops: 'Crop', pests: 'Pest', soil: 'Soil', livestock: 'Livestock', video: 'Video',
};
const TYPE_COLOR: Record<string, string> = {
  crops: '#00ff88', pests: '#ff8a3d', soil: '#c68a5c', livestock: '#b47aff', video: '#4fc3f7',
};
const SEVERITY_COLOR: Record<string, string> = {
  high: '#ff3b5c', moderate: '#ffb300', low: '#00ff88',
};

type Tab = 'overview' | 'grouped' | 'radar' | 'review' | 'live';
type GroupBy = 'day' | 'state' | 'type' | 'model';

interface AdminScan {
  id: string;
  user_id: string;
  type: string;
  model_key: string;
  top_label: string;
  confidence: number;
  all_predictions: any[];
  image_url: string | null;
  recommendation: string | null;
  outcome: string | null;
  on_device: boolean;
  inference_ms: number | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  user_state?: string;
  user_lga?: string;
  user_avatar?: string | null;
  user_kyc?: string;
}

function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function dayLabel(s: string) {
  const d = new Date(s);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const fmt = (x: Date) => x.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return fmt(d);
}

export default function AdminScans() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const { isAdmin, isSuperAdmin } = useIsAdmin();

  const [tab, setTab] = useState<Tab>('overview');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [scans, setScans] = useState<AdminScan[]>([]);
  const [stats, setStats] = useState<any>({});
  const [radar, setRadar] = useState<any[]>([]);
  const [review, setReview] = useState<AdminScan[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [selected, setSelected] = useState<AdminScan | null>(null);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const [s, r, scanRes, revRes] = await Promise.all([
        supabase.rpc('admin_scan_stats', { p_days: 30 }),
        supabase.rpc('admin_outbreak_radar', { p_days: 7 }),
        supabase
          .from('scan_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('scan_history')
          .select('*')
          .lt('confidence', 60)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (!s.error) setStats(s.data || {});
      if (!r.error) setRadar(r.data || []);

      const scanRows = scanRes.data || [];
      const userIds = Array.from(new Set(scanRows.map((x: any) => x.user_id))).filter(Boolean) as string[];

      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, email, phone, state, lga, avatar_url, verification_status')
          .in('user_id', userIds);
        (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      }

      const enrich = (s: any): AdminScan => {
        const p = profileMap[s.user_id] || {};
        return {
          ...s,
          user_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown',
          user_email: p.email,
          user_phone: p.phone,
          user_state: p.state,
          user_lga: p.lga,
          user_avatar: p.avatar_url,
          user_kyc: p.verification_status,
        };
      };

      setScans(scanRows.map(enrich));
      setReview((revRes.data || []).map(enrich));
    } catch (e) {
      console.warn('admin scans load failed', e);
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const filtered = userFilter ? scans.filter((s) => s.user_id === userFilter) : scans;

  const filteredBySearch = userSearch.trim()
    ? filtered.filter((s) => {
        const hay = (s.top_label || '') + ' ' + (s.user_name || '') + ' ' + (s.user_state || '');
        return hay.toLowerCase().includes(userSearch.toLowerCase());
      })
    : filtered;

  const buildGroups = (list: AdminScan[]): Record<string, AdminScan[]> => {
    const groups: Record<string, AdminScan[]> = {};
    list.forEach((s) => {
      let key = '';
      if (groupBy === 'day') key = dayLabel(s.created_at);
      else if (groupBy === 'state') key = s.user_state || 'Unknown state';
      else if (groupBy === 'type') key = TYPE_LABEL[s.type] || s.type;
      else key = s.model_key || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  };

  const grouped = buildGroups(filteredBySearch);

  const byType = stats.by_type || {};
  const topDiseases = stats.top_diseases || [];
  const topStates = stats.top_states || [];

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
        <Text style={styles.sub}>
          {scans.length} scans · {new Set(scans.map(s => s.user_id)).size} farmers
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['overview', 'grouped', 'radar', 'review', 'live'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tabBtn, tab === t && styles.tabBtnOn]}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {userFilter ? (
          <View style={styles.filterBanner}>
            <Text style={styles.filterText} numberOfLines={1}>
              Filtering: {scans.find(s => s.user_id === userFilter)?.user_name || userFilter.slice(0, 8)}
            </Text>
            <Pressable onPress={() => setUserFilter(null)}>
              <Text style={styles.filterClear}>CLEAR</Text>
            </Pressable>
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {tab === 'overview' ? (
          <>
            <View style={styles.grid}>
              <Stat label="TOTAL" value={stats.total ?? 0} palette={palette} />
              <Stat label="7D" value={stats.last_7d ?? 0} palette={palette} />
              <Stat label="30D" value={stats.last_30d ?? 0} palette={palette} />
              <Stat label="AVG CONF" value={(stats.avg_confidence ?? 0) + '%'} palette={palette} />
              <Stat label="ON-DEVICE" value={stats.on_device_count ?? 0} palette={palette} accent={palette.neon} />
              <Stat label="SERVER" value={stats.server_count ?? 0} palette={palette} />
            </View>

            <Text style={styles.sectionLabel}>BY TYPE</Text>
            {Object.entries(byType).length === 0 ? (
              <Text style={styles.empty}>No scans yet.</Text>
            ) : Object.entries(byType).map(([k, v]: any) => (
              <View key={k} style={styles.barRow}>
                <Text style={styles.barLabel}>{TYPE_LABEL[k] || k}</Text>
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
          </>
        ) : null}

        {tab === 'grouped' ? (
          <>
            <View style={styles.subTabRow}>
              {(['day', 'state', 'type', 'model'] as GroupBy[]).map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGroupBy(g)}
                  style={[styles.subTab, groupBy === g && styles.subTabOn]}
                >
                  <Text style={[styles.subTabText, groupBy === g && styles.subTabTextOn]}>
                    {g === 'day' ? 'BY DAY' : g === 'state' ? 'BY STATE' : g === 'type' ? 'BY TYPE' : 'BY MODEL'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search label, farmer, or state..."
              placeholderTextColor={palette.textDim}
              style={styles.search}
            />

            {Object.entries(grouped).length === 0 ? (
              <Text style={styles.empty}>No scans match.</Text>
            ) : Object.entries(grouped).map(([key, items]) => (
              <View key={key} style={{ marginBottom: 20 }}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{key}</Text>
                  <Text style={styles.groupCount}>
                    {items.length} scan{items.length === 1 ? '' : 's'} · {new Set(items.map(i => i.user_id)).size} farmer{new Set(items.map(i => i.user_id)).size === 1 ? '' : 's'}
                  </Text>
                </View>
                {items.map((s) => (
                  <Pressable key={s.id} onPress={() => setSelected(s)} style={styles.scanCard}>
                    {s.image_url ? (
                      <Image source={{ uri: s.image_url }} style={styles.scanThumb} />
                    ) : (
                      <View style={[styles.scanThumb, styles.scanThumbEmpty]}>
                        <Text style={[styles.scanThumbTxt, { color: TYPE_COLOR[s.type] || palette.neon }]}>
                          {(TYPE_LABEL[s.type] || '?').charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.typeBadge, { color: TYPE_COLOR[s.type] || palette.neon, borderColor: TYPE_COLOR[s.type] || palette.neon }]}>
                          {TYPE_LABEL[s.type] || s.type}
                        </Text>
                        {s.on_device ? <Text style={styles.onDeviceBadge}>ON-DEVICE</Text> : null}
                      </View>
                      <Text style={styles.scanLabel} numberOfLines={1}>{s.top_label}</Text>
                      <Text style={styles.scanUser} numberOfLines={1}>
                        {s.user_name} {s.user_state ? '· ' + s.user_state : ''}
                      </Text>
                      <Text style={styles.scanMeta}>
                        {Math.round(s.confidence || 0)}% · {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {tab === 'radar' ? (
          <>
            <Text style={styles.sectionLabel}>ACTIVE OUTBREAKS (7 DAYS)</Text>
            {radar.length === 0 ? (
              <Text style={styles.empty}>No clusters. Everything looks normal.</Text>
            ) : radar.map((r: any, i: number) => {
              const color = SEVERITY_COLOR[r.scan_count >= 10 ? 'high' : r.scan_count >= 5 ? 'moderate' : 'low'] || palette.neon;
              return (
                <View key={i} style={[styles.alertCard, { borderLeftColor: color }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.alertTitle}>{r.top_label}</Text>
                    <Text style={[styles.alertBadge, { color }]}>{r.scan_count} scans</Text>
                  </View>
                  <Text style={styles.alertMeta}>{r.type} · {r.state}{r.lga ? ' / ' + r.lga : ''}</Text>
                  <Text style={styles.alertMeta}>Avg {r.avg_conf}% · {fmtDate(r.last_seen)}</Text>
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
            ) : review.map((s) => (
              <Pressable key={s.id} onPress={() => setSelected(s)} style={styles.scanCard}>
                {s.image_url ? (
                  <Image source={{ uri: s.image_url }} style={styles.scanThumb} />
                ) : (
                  <View style={[styles.scanThumb, styles.scanThumbEmpty]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.scanLabel} numberOfLines={1}>{s.top_label}</Text>
                  <Text style={styles.scanUser} numberOfLines={1}>{s.user_name} · {s.user_state || '—'}</Text>
                  <Text style={styles.scanMeta}>{Math.round(s.confidence || 0)}% · {fmtDate(s.created_at)}</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {tab === 'live' ? (
          <>
            <Text style={styles.sectionLabel}>RECENT ({filteredBySearch.length})</Text>
            {filteredBySearch.slice(0, 100).map((s) => (
              <Pressable key={s.id} onPress={() => setSelected(s)} style={styles.scanCard}>
                {s.image_url ? (
                  <Image source={{ uri: s.image_url }} style={styles.scanThumb} />
                ) : (
                  <View style={[styles.scanThumb, styles.scanThumbEmpty]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.scanLabel} numberOfLines={1}>{s.top_label}</Text>
                  <Text style={styles.scanUser} numberOfLines={1}>{s.user_name} · {s.user_state || '—'}</Text>
                  <Text style={styles.scanMeta}>
                    {TYPE_LABEL[s.type]} · {Math.round(s.confidence || 0)}% · {s.on_device ? 'On-device' : 'Server'}
                  </Text>
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

              {selected ? (
                <>
                  {selected.image_url ? (
                    <Image source={{ uri: selected.image_url }} style={styles.modalImage} resizeMode="contain" />
                  ) : null}

                  <Text style={styles.modalTitle}>{selected.top_label}</Text>
                  <Text style={styles.modalSub}>
                    {TYPE_LABEL[selected.type]} · {Math.round(selected.confidence || 0)}% · {fmtDate(selected.created_at)}
                  </Text>

                  <View style={styles.userCard}>
                    {selected.user_avatar ? (
                      <Image source={{ uri: selected.user_avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarTxt}>{(selected.user_name || 'U').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{selected.user_name}</Text>
                      <Text style={styles.userMeta} numberOfLines={1}>{selected.user_email}</Text>
                      <Text style={styles.userMeta} numberOfLines={1}>
                        {selected.user_phone || '—'} · {selected.user_state || '—'}{selected.user_lga ? ' / ' + selected.user_lga : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        {selected.user_kyc === 'approved' ? (
                          <Text style={[styles.kycBadge, styles.kycApproved]}>KYC VERIFIED</Text>
                        ) : (
                          <Text style={[styles.kycBadge, styles.kycPending]}>KYC {String(selected.user_kyc || 'pending').toUpperCase()}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable
                      onPress={() => { setSelected(null); router.push('/admin-users' as any); }}
                      style={[styles.actionBtn, { flex: 1 }]}
                    >
                      <Text style={styles.actionTxt}>OPEN PROFILE</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setSelected(null); router.push(('/chat-room?uid=' + selected.user_id) as any); }}
                      style={[styles.actionBtn, { flex: 1, borderColor: palette.neon }]}
                    >
                      <Text style={[styles.actionTxt, { color: palette.neon }]}>MESSAGE</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setUserFilter(selected.user_id); setSelected(null); setTab('grouped'); }}
                      style={[styles.actionBtn, { flex: 1, borderColor: palette.warning }]}
                    >
                      <Text style={[styles.actionTxt, { color: palette.warning }]}>ALL SCANS</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.sectionLabel}>SCAN DETAILS</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Model: </Text>{selected.model_key}</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Device: </Text>{selected.on_device ? 'On-device' : 'Server'}</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Inference: </Text>{selected.inference_ms || '—'} ms</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Outcome: </Text>{selected.outcome || '—'}</Text>

                  <Text style={styles.sectionLabel}>PREDICTIONS</Text>
                  {(selected.all_predictions || []).slice(0, 6).map((p: any, i: number) => (
                    <View key={i} style={styles.barRow}>
                      <Text style={styles.barLabel} numberOfLines={1}>{p.label}</Text>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: Math.min(100, p.confidence) + '%' }]} />
                      </View>
                      <Text style={styles.barVal}>{Math.round(p.confidence)}%</Text>
                    </View>
                  ))}

                  {selected.recommendation ? (
                    <>
                      <Text style={styles.sectionLabel}>TREATMENT GUIDE</Text>
                      <View style={styles.recBox}>
                        <MarkdownOutput content={selected.recommendation} />
                      </View>
                    </>
                  ) : null}

                  <View style={{ height: 60 }} />
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, palette, accent }: any) {
  return (
    <View style={[{
      width: '31%', padding: 14, borderRadius: 12,
      backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
      alignItems: 'center',
    }]}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: accent || palette.neon }} numberOfLines={1}>{value}</Text>
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
  subTabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  subTab: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  subTabOn: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  subTabText: { fontSize: 9, fontWeight: '800', color: p.textDim, letterSpacing: 1 },
  subTabTextOn: { color: p.neon },
  search: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 14 },
  filterBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 8, borderWidth: 1, borderColor: p.neon, marginBottom: 12 },
  filterText: { fontSize: 11, color: p.neon, fontWeight: '700', flex: 1 },
  filterClear: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: p.neon, marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { width: 100, fontSize: 11, color: p.text },
  barBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 3 },
  barVal: { width: 40, fontSize: 11, color: p.textMuted, textAlign: 'right' },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  groupTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  groupCount: { fontSize: 10, color: p.textMuted, fontWeight: '600' },
  scanCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  scanThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.2)' },
  scanThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  scanThumbTxt: { fontSize: 20, fontWeight: '900' },
  typeBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  onDeviceBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,255,136,0.15)', color: p.neon },
  scanLabel: { fontSize: 13, fontWeight: '800', color: p.text, marginTop: 3 },
  scanUser: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  scanMeta: { fontSize: 10, color: p.textDim, marginTop: 2 },
  chevron: { fontSize: 18, color: p.textDim },
  alertCard: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderLeftWidth: 4, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  alertTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  alertBadge: { fontSize: 11, fontWeight: '900' },
  alertMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '94%' },
  modalImage: { width: '100%', height: 260, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', marginVertical: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text },
  modalSub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '900', color: p.neon },
  userName: { fontSize: 15, fontWeight: '800', color: p.text },
  userMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  kycBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  kycApproved: { backgroundColor: 'rgba(0,255,136,0.15)', color: p.neon },
  kycPending: { backgroundColor: 'rgba(255,179,0,0.15)', color: p.warning },
  actionBtn: { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  actionTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: p.text },
  kv: { fontSize: 12, color: p.text, marginBottom: 6, lineHeight: 18 },
  k: { color: p.neon, fontWeight: '700' },
  recBox: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
