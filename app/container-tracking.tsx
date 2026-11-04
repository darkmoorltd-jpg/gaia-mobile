import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import DriverRouteMap from '../src/components/DriverRouteMap';

const STATUS_FLOW = ['loading', 'shipped', 'arrived'];
const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  loading: { label: 'LOADING', color: '#ffb300', icon: '📦' },
  shipped: { label: 'SHIPPED', color: '#3b82f6', icon: '🚢' },
  arrived: { label: 'ARRIVED', color: '#00ff88', icon: '✅' },
};

export default function ContainerTracking() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [containers, setContainers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase
      .from('containers')
      .select('*, container_batches(batch_id, batches(batch_code, crop_name, quantity_kg, status))')
      .eq('exporter_id', user.id)
      .order('created_at', { ascending: false });
    setContainers(data || []);
    setBusy(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const advance = async (container: any) => {
    const current = STATUS_FLOW.indexOf(container.status);
    if (current < 0 || current >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[current + 1];

    Alert.alert(
      `Mark as ${next.toUpperCase()}?`,
      `Container ${container.container_number} will move to ${next} status.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          const rpc = next === 'shipped' ? 'container_mark_shipped' : 'container_mark_arrived';
          const { error } = await supabase.rpc(rpc, { p_container_id: container.id });
          if (error) { Alert.alert('Failed', error.message); return; }
          load();
        }},
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Container Tracking</Text>
        <Text style={styles.sub}>Track live export shipments to destination.</Text>

        {busy && containers.length === 0 ? <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} /> : null}

        {!busy && containers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No containers yet</Text>
            <Text style={styles.emptySub}>Create a container on the Exporter Dashboard to start tracking.</Text>
          </View>
        ) : null}

        {containers.map(c => {
          const meta = STATUS_META[c.status] || STATUS_META.loading;
          const batches = (c.container_batches || []).map((x: any) => x.batches).filter(Boolean);
          const total_kg = batches.reduce((a: number, b: any) => a + Number(b.quantity_kg || 0), 0);
          const canAdvance = STATUS_FLOW.indexOf(c.status) < STATUS_FLOW.length - 1;
          const nextStep = canAdvance ? STATUS_FLOW[STATUS_FLOW.indexOf(c.status) + 1] : null;

          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.containerNum}>{c.container_number}</Text>
                <View style={[styles.statusChip, { borderColor: meta.color }]}>
                  <Text style={[styles.statusTxt, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                </View>
              </View>

              <View style={styles.route}>
                <Text style={styles.port}>🇳🇬 {c.departure_port || 'Apapa'}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.port}>🌍 {c.destination_country}</Text>
              </View>

              <View style={styles.timeline}>
                {STATUS_FLOW.map((step, i) => {
                  const active = STATUS_FLOW.indexOf(c.status) >= i;
                  const isCurrent = c.status === step;
                  return (
                    <View key={step} style={styles.timelineStep}>
                      <View style={[styles.timelineDot, active && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]} />
                      {i < STATUS_FLOW.length - 1 ? (
                        <View style={[styles.timelineLine, active && { backgroundColor: '#3b82f6' }]} />
                      ) : null}
                      <Text style={[styles.timelineLabel, active && { color: '#3b82f6' }, isCurrent && { fontWeight: '900' }]}>
                        {STATUS_META[step].label}
                      </Text>
                      <Text style={styles.timelineTime}>
                        {step === 'loading' && c.created_at ? new Date(c.created_at).toLocaleDateString() :
                         step === 'shipped' && c.shipped_at ? new Date(c.shipped_at).toLocaleDateString() :
                         step === 'arrived' && c.arrived_at ? new Date(c.arrived_at).toLocaleDateString() : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.stats}>
                {batches.length} batches · {total_kg.toLocaleString()}kg total
              </Text>

              {batches.length > 0 ? (
                <View style={styles.batchList}>
                  {batches.slice(0, 5).map((b: any, i: number) => (
                    <Text key={i} style={styles.batchItem}>• {b.batch_code} · {b.crop_name} ({b.quantity_kg}kg)</Text>
                  ))}
                  {batches.length > 5 ? <Text style={styles.batchMore}>... and {batches.length - 5} more</Text> : null}
                </View>
              ) : null}

              {batches.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.sectionMini}>LIVE DRIVER ROUTE</Text>
                  <DriverRouteMap batchId={batches[0].id || ''} height={220} />
                </View>
              ) : null}

              {nextStep ? (
                <Pressable onPress={() => advance(c)} style={styles.advanceBtn}>
                  <Text style={styles.advanceTxt}>MARK AS {nextStep.toUpperCase()} {STATUS_META[nextStep].icon}</Text>
                </Pressable>
              ) : (
                <Text style={styles.arrivedText}>✅ Delivered to destination</Text>
              )}
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: p.text },
  emptySub: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  containerNum: { fontSize: 16, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  route: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  port: { fontSize: 13, fontWeight: '800', color: p.text },
  arrow: { fontSize: 16, color: '#3b82f6', fontWeight: '900' },
  timeline: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 8 },
  timelineStep: { flex: 1, alignItems: 'center', position: 'relative' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: p.surface, borderWidth: 2, borderColor: p.border, zIndex: 2 },
  timelineLine: { position: 'absolute', top: 5, left: '50%', right: '-50%', height: 2, backgroundColor: p.border, zIndex: 1 },
  timelineLabel: { fontSize: 9, fontWeight: '700', color: p.textMuted, marginTop: 8, letterSpacing: 1 },
  timelineTime: { fontSize: 9, color: p.textDim, marginTop: 2 },
  stats: { fontSize: 12, color: p.textMuted, textAlign: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  batchList: { paddingVertical: 8 },
  batchItem: { fontSize: 11, color: p.text, marginBottom: 4, fontFamily: 'monospace' },
  batchMore: { fontSize: 10, color: p.textDim, fontStyle: 'italic', marginTop: 4 },
  advanceBtn: { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#3b82f6', alignItems: 'center' },
  advanceTxt: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  arrivedText: { marginTop: 12, fontSize: 12, fontWeight: '800', color: p.neon, textAlign: 'center' },
  sectionMini: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 6 },
});
