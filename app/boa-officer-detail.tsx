import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { GoogleMap } from '../src/components/GoogleMap';

const fmtDate = (s?: string) => s ? new Date(s).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
const fmtN = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function BoaOfficerDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email === 'darkmoorltd@gmail.com';

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [tab, setTab] = useState<'visits' | 'map'>('visits');

  const load = useCallback(async () => {
    if (!isAdmin || !params.id) return;
    setBusy(true);
    const r = await supabase.rpc('boa_officer_detail', { p_officer_id: params.id });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin, params.id]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.center}><Text style={styles.blockedText}>Access denied</Text></View>;
  if (busy && !data) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;
  if (!data || !data.officer) return <View style={styles.center}><Text style={styles.blockedText}>Officer not found</Text></View>;

  const off = data.officer || {};
  const sum = data.summary || {};
  const visits = data.recent_visits || [];
  const verifiedPct = sum.visits_30d > 0 ? Math.round((sum.verified_30d / sum.visits_30d) * 100) : 0;
  const verifiedColor = verifiedPct >= 80 ? '#00ff88' : verifiedPct >= 50 ? '#ffb300' : '#ff3b5c';

  const mapPoints = visits.filter((v: any) => v.lat && v.lng).map((v: any) => ({
    latitude: Number(v.lat),
    longitude: Number(v.lng),
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{(off.full_name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{off.full_name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{off.zone || '-'} · {off.phone || '-'}</Text>
          </View>
        </View>

        {off.phone ? (
          <View style={styles.actions}>
            <Pressable onPress={() => Linking.openURL('tel:' + off.phone)} style={[styles.actionBtn, { borderColor: '#00ff88' }]}>
              <Text style={[styles.actionTxt, { color: '#00ff88' }]}>CALL</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL('https://wa.me/' + String(off.phone).replace(/[^0-9]/g, ''))} style={[styles.actionBtn, { borderColor: '#25d366' }]}>
              <Text style={[styles.actionTxt, { color: '#25d366' }]}>WHATSAPP</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{sum.visits_30d || 0}</Text>
            <Text style={styles.kpiLbl}>VISITS 30D</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: verifiedColor }]}>{verifiedPct}%</Text>
            <Text style={styles.kpiLbl}>VERIFIED</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{fmtN(sum.cash_30d)}</Text>
            <Text style={styles.kpiLbl}>CASH 30D</Text>
          </View>
        </View>

        {sum.unverified_30d > 0 ? (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>WARNING: {sum.unverified_30d} UNVERIFIED VISITS</Text>
            <Text style={styles.warningText}>
              These visits were logged more than 200m from the farm pin. Review them for possible fraud.
            </Text>
          </View>
        ) : null}

        <View style={styles.chips}>
          <Pressable onPress={() => setTab('visits')} style={[styles.chip, tab === 'visits' && styles.chipOn]}>
            <Text style={[styles.chipText, tab === 'visits' && styles.chipTextOn]}>VISITS ({visits.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('map')} style={[styles.chip, tab === 'map' && styles.chipOn]}>
            <Text style={[styles.chipText, tab === 'map' && styles.chipTextOn]}>MAP ({mapPoints.length})</Text>
          </Pressable>
        </View>

        {tab === 'visits' ? (
          visits.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.kv}>No visits logged yet.</Text>
            </View>
          ) : (
            visits.map((v: any, i: number) => (
              <View key={i} style={[styles.visitCard, { borderLeftColor: v.verified ? '#00ff88' : '#ff3b5c' }]}>
                <View style={styles.visitHead}>
                  <Text style={[styles.visitBadge, { color: v.verified ? '#00ff88' : '#ff3b5c' }]}>
                    {v.verified ? 'VERIFIED' : 'UNVERIFIED'}
                  </Text>
                  <Text style={styles.visitDate}>{fmtDate(v.visited_at)}</Text>
                </View>
                <Text style={styles.visitFarmer} numberOfLines={1}>{v.farmer_name || v.farmer_email || 'Unknown farmer'}</Text>
                {v.note ? <Text style={styles.visitNote}>"{v.note}"</Text> : null}
                <View style={styles.visitMetaRow}>
                  {Number(v.cash) > 0 ? (
                    <Text style={styles.visitCash}>{fmtN(v.cash)} collected</Text>
                  ) : null}
                  {v.distance_m !== null && v.distance_m !== undefined ? (
                    <Text style={[styles.visitDist, { color: Number(v.distance_m) < 200 ? '#00ff88' : '#ff3b5c' }]}>
                      {Number(v.distance_m).toFixed(0)}m from farm pin
                    </Text>
                  ) : (
                    <Text style={styles.visitDist}>Farm pin not mapped</Text>
                  )}
                </View>
              </View>
            ))
          )
        ) : (
          mapPoints.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.kv}>No GPS data recorded yet.</Text>
            </View>
          ) : (
            <View style={styles.mapBox}>
              <GoogleMap
                points={mapPoints}
                height={420}
                display="points"
                mapType="standard"
              />
            </View>
          )
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  center: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 18, fontWeight: '900', color: p.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 2, borderColor: '#00ff88', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '900', color: '#00ff88' },
  name: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 18, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  kpiLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  warning: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,59,92,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.35)', marginBottom: 16 },
  warningTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#ff3b5c', marginBottom: 4 },
  warningText: { fontSize: 11, color: p.textMuted, lineHeight: 17 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  chip: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  empty: { padding: 30, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  visitCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  visitHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  visitBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  visitDate: { fontSize: 10, color: p.textMuted, fontWeight: '700' },
  visitFarmer: { fontSize: 14, fontWeight: '900', color: p.text, marginBottom: 4 },
  visitNote: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', marginBottom: 8, lineHeight: 17 },
  visitMetaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  visitCash: { fontSize: 12, fontWeight: '800', color: '#00ff88' },
  visitDist: { fontSize: 11, fontWeight: '700' },
  mapBox: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: p.borderHi },
});
