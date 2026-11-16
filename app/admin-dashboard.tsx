import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import NotificationBell from '../src/components/NotificationBell';
import { usePushRegistration } from '../src/hooks/usePushRegistration';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  usePushRegistration(user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpi, setKpi] = useState({
    whPending: 0, drvPending: 0, wdPending: 0, alerts: 0,
    revenue: 0, activeDrivers: 0, activeUnits: 0,
  });
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [
      whP, drvP, wdP, alertsQ, revQ, drvA, unitA,
    ] = await Promise.all([
      supabase.from('warehouse_companies').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('driver_profiles').select('user_id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('driver_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('admin_alerts').select('*').is('read_at', null).order('created_at', { ascending: false }).limit(20),
      supabase.from('ledger_entries').select('debit').eq('reference_type', 'warehouse_registration'),
      supabase.from('driver_profiles').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('warehouse_units').select('id', { count: 'exact', head: true }).eq('is_listed', true),
    ]);
    const revenue = (revQ.data || []).reduce((s: number, r: any) => s + Number(r.debit || 0), 0);
    setKpi({
      whPending: whP.count || 0,
      drvPending: drvP.count || 0,
      wdPending: wdP.count || 0,
      alerts: (alertsQ.data || []).length,
      revenue,
      activeDrivers: drvA.count || 0,
      activeUnits: unitA.count || 0,
    });
    setAlerts(alertsQ.data || []);
    setBusy(false);
  }, [isAdmin]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel('admin_alerts_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_alerts' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, load]);

  const markAllRead = async () => {
    await supabase.rpc('admin_mark_alerts_read', { p_ids: null });
    await load();
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.title}>Admin Control</Text>
            <NotificationBell />
          </View>
          <Text style={styles.sub}>Everything at a glance</Text>
        </View>

        <View style={styles.kpiRow}>
          <KPICard label="WAREHOUSES" value={kpi.whPending} sub="pending" accent="#ffb300" onPress={() => router.push('/admin-warehouses' as any)} />
          <KPICard label="DRIVERS" value={kpi.drvPending} sub="pending" accent="#3b82f6" onPress={() => router.push('/admin-drivers' as any)} />
          <KPICard label="WITHDRAWALS" value={kpi.wdPending} sub="pending" accent="#ff3b5c" />
        </View>

        <View style={styles.kpiRow}>
          <KPICard label="REVENUE" value={`₦${(kpi.revenue / 1000).toFixed(0)}k`} sub="reg fees" accent={palette.neon} />
          <KPICard label="ACTIVE DRIVERS" value={kpi.activeDrivers} sub="online" accent="#3b82f6" />
          <KPICard label="LISTED UNITS" value={kpi.activeUnits} sub="warehouse" accent={palette.neon} />
        </View>

        <View style={styles.alertsHeader}>
          <Text style={styles.sectionLabel}>ALERTS ({kpi.alerts})</Text>
          {kpi.alerts > 0 ? (
            <Pressable onPress={markAllRead}><Text style={styles.markRead}>MARK ALL READ</Text></Pressable>
          ) : null}
        </View>

        {busy && alerts.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && alerts.length === 0 ? <Text style={styles.empty}>No unread alerts.</Text> : null}

        {alerts.map(a => {
          const accent = a.kind.includes('warehouse') ? '#ffb300' : a.kind.includes('driver') ? '#3b82f6' : '#ff3b5c';
          return (
            <Pressable key={a.id} onPress={() => {
              if (a.kind.includes('warehouse')) router.push(`/admin-warehouse-detail?id=${a.ref_id}` as any);
              else if (a.kind.includes('driver') && !a.kind.includes('withdrawal')) router.push(`/admin-driver-detail?id=${a.ref_id}` as any);
            }} style={[styles.alertCard, { borderLeftColor: accent, borderLeftWidth: 4 }]}>
              <Text style={styles.alertTitle}>{a.title}</Text>
              {a.body ? <Text style={styles.alertBody}>{a.body}</Text> : null}
              <Text style={styles.alertTime}>{new Date(a.created_at).toLocaleString()}</Text>
            </Pressable>
          );
        })}

        <Text style={styles.sectionLabel}>QUICK LINKS</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'Warehouses', route: '/admin-warehouses', icon: '🏢' },
            { label: 'Drivers', route: '/admin-drivers', icon: '🚛' },
            { label: 'Farms', route: '/admin-farms', icon: '🌾' },
            { label: 'Loans', route: '/admin-loans', icon: '💰' },
            { label: 'Payments', route: '/admin-payments', icon: '💳' },
            { label: 'Users', route: '/admin-users', icon: '👥' },
            { label: 'Scans', route: '/admin-scans', icon: '📸' },
            { label: 'Audit', route: '/admin-audit', icon: '📋' },
          ].map(q => (
            <Pressable key={q.route} onPress={() => router.push(q.route as any)} style={styles.quickTile}>
              <Text style={styles.quickIcon}>{q.icon}</Text>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function KPICard({ label, value, sub, accent, onPress }: any) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={{ flex: 1, backgroundColor: '#141414', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: accent, borderTopWidth: 3 }}>
      <Text style={{ fontSize: 9, fontWeight: '900', color: accent, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{sub}</Text>
    </Wrapper>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: '#ff3b5c' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  alertsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 8 },
  markRead: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', padding: 20 },
  alertCard: { backgroundColor: p.surface, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  alertTitle: { fontSize: 13, fontWeight: '900', color: p.text },
  alertBody: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  alertTime: { fontSize: 10, color: p.textDim, marginTop: 6 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTile: { width: '23%', aspectRatio: 1, backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  quickIcon: { fontSize: 22, marginBottom: 4 },
  quickLabel: { fontSize: 9, color: p.text, fontWeight: '700', textAlign: 'center' },
});
