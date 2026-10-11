import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });
const money = (n: any) => 'N' + num(n, 0);
const daysAgo = (iso: string | null) => {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return 'just now';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString();
};

export default function AgentHome() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const signOut = useAuth((s) => s.signOut);

  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const [s, r] = await Promise.all([
      supabase.rpc('agent_dashboard'),
      supabase.rpc('agent_my_farmers', { p_filter: 'all', p_search: null, p_limit: 6 }),
    ]);
    if (!s.error) setStats(s.data);
    if (!r.error) setRecent(r.data || []);
    setBusy(false);
    setRef(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const logout = async () => { await signOut(); router.replace('/(auth)/login'); };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={styles.badgeDot} />
              <Text style={styles.badge}>GAIA AGENT</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>{stats?.agent_name || 'Agent'}</Text>
            <Text style={styles.meta}>
              {(stats?.agent_zone || 'Zone not set') + '  ·  ' + (stats?.agent_code || 'No code')}
            </Text>
          </View>
          <Pressable onPress={logout} style={styles.logout}>
            <Text style={styles.logoutText}>EXIT</Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={['#00cc6a', '#009e52', '#00582e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.earningsCard}
        >
          <Text style={styles.earningsLabel}>TOTAL EARNINGS</Text>
          <Text style={styles.earningsVal}>{money(stats?.comm_total)}</Text>
          <View style={styles.earningsBreak}>
            <View style={styles.earningsCol}>
              <Text style={styles.earningsColVal}>{money(stats?.comm_pending)}</Text>
              <Text style={styles.earningsColLbl}>PENDING</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsCol}>
              <Text style={styles.earningsColVal}>{money(stats?.comm_paid)}</Text>
              <Text style={styles.earningsColLbl}>PAID OUT</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsCol}>
              <Text style={styles.earningsColVal}>{money(stats?.comm_7d)}</Text>
              <Text style={styles.earningsColLbl}>THIS WEEK</Text>
            </View>
          </View>
          <Text style={styles.earningsFoot}>N500 paid per farmer you verify and get approved</Text>
        </LinearGradient>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(stats?.verified_approved)}</Text>
            <Text style={styles.kpiLbl}>VERIFIED</Text>
            <Text style={styles.kpiSub}>{num(stats?.verified_total) + ' total submitted'}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(stats?.registered_total)}</Text>
            <Text style={styles.kpiLbl}>REGISTERED</Text>
            <Text style={styles.kpiSub}>{num(stats?.registered_30d) + ' this month'}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: '#ffb300' }]}>{num(stats?.verified_pending)}</Text>
            <Text style={styles.kpiLbl}>PENDING</Text>
            <Text style={styles.kpiSub}>awaiting approval</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/agent/register' as any)} style={styles.bigAction}>
          <LinearGradient
            colors={['#7c4dff', '#b388ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bigActionGrad}
          >
            <Text style={styles.bigActionIcon}>+</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigActionTitle}>REGISTER FARMER</Text>
              <Text style={styles.bigActionSub}>Create a GAIA account on behalf of a farmer</Text>
            </View>
            <Text style={styles.bigActionChevron}>›</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.push('/agent/verify' as any)} style={styles.bigAction}>
          <LinearGradient
            colors={['#00c853', '#69f0ae']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bigActionGrad}
          >
            <Text style={styles.bigActionIcon}>V</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigActionTitle}>VERIFY FARMER</Text>
              <Text style={styles.bigActionSub}>Submit KYC · earns N500 on approval</Text>
            </View>
            <Text style={styles.bigActionChevron}>›</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          <Pressable onPress={() => router.push('/agent/farmers' as any)}>
            <Text style={styles.viewAll}>VIEW ALL</Text>
          </Pressable>
        </View>

        {busy && recent.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {!busy && recent.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No farmers yet</Text>
            <Text style={styles.emptySub}>Tap REGISTER FARMER above to add your first farmer.</Text>
          </View>
        ) : null}

        {recent.map((r, i) => {
          const verified = r.bucket === 'approved';
          const pending = r.bucket === 'pending';
          const rejected = r.bucket === 'rejected';
          const color = verified ? '#00ff88' : pending ? '#ffb300' : rejected ? '#ff3b5c' : '#8899a6';
          const icon = verified ? 'V' : pending ? 'P' : rejected ? 'X' : '+';
          const label = verified ? 'Verified' : pending ? 'Pending review' : rejected ? 'Rejected' : 'Registered';
          return (
            <View key={i} style={styles.activity}>
              <View style={[styles.activityIcon, { borderColor: color }]}>
                <Text style={[styles.activityIconText, { color }]}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityName} numberOfLines={1}>{r.name || r.email}</Text>
                <Text style={styles.activityMeta} numberOfLines={1}>
                  {label + '  ·  ' + (r.state || 'No state') + (r.lga ? ' / ' + r.lga : '')}
                </Text>
                <Text style={styles.activityTime}>
                  {daysAgo(r.last_activity) + (verified ? '  ·  +N500' : '')}
                </Text>
              </View>
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
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: p.neon },
  badge: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon },
  name: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5, marginTop: 4 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  logout: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: p.danger },
  logoutText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
  earningsCard: { padding: 24, borderRadius: 24, marginBottom: 16 },
  earningsLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  earningsVal: { fontSize: 44, fontWeight: '900', color: '#ffffff', letterSpacing: -2, marginTop: 4 },
  earningsBreak: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  earningsCol: { flex: 1, alignItems: 'center' },
  earningsColVal: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
  earningsColLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  earningsDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  earningsFoot: { fontSize: 10, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 14, fontStyle: 'italic' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpi: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  kpiLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: p.textMuted, marginTop: 4 },
  kpiSub: { fontSize: 9, color: p.textDim, marginTop: 4 },
  bigAction: { borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  bigActionGrad: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  bigActionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff', fontSize: 22, fontWeight: '900', textAlign: 'center', lineHeight: 44, marginRight: 14 },
  bigActionTitle: { fontSize: 14, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
  bigActionSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  bigActionChevron: { fontSize: 26, color: '#ffffff', fontWeight: '300', marginLeft: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted },
  viewAll: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  emptySub: { fontSize: 11, color: p.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 16 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  activityIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  activityIconText: { fontSize: 16, fontWeight: '900' },
  activityName: { fontSize: 13, fontWeight: '800', color: p.text },
  activityMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  activityTime: { fontSize: 10, color: p.textDim, marginTop: 2 },
});
