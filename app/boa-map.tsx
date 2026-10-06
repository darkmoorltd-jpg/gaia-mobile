import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { GoogleMap } from '../src/components/GoogleMap';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const { width } = Dimensions.get('window');

export default function BoaMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [data, setData] = useState<any>({ borrowers: [], outbreaks: [] });
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [layer, setLayer] = useState<'borrowers' | 'outbreaks'>('borrowers');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_map_data', { p_zone: null, p_days: 30 });
    if (!r.error) setData(r.data || { borrowers: [], outbreaks: [] });
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const borrowers = (data.borrowers || []).map((b: any) => ({
    latitude: Number(b.lat),
    longitude: Number(b.lng),
  }));
  const outbreaks = (data.outbreaks || []).map((o: any) => ({
    latitude: Number(o.lat),
    longitude: Number(o.lng),
  }));
  const points = layer === 'borrowers' ? borrowers : outbreaks;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Portfolio Map</Text>
        <Text style={styles.sub}>{borrowers.length} borrowers · {outbreaks.length} outbreaks</Text>

        <View style={styles.chips}>
          <Pressable onPress={() => setLayer('borrowers')} style={[styles.chip, layer === 'borrowers' && styles.chipOn]}>
            <Text style={[styles.chipText, layer === 'borrowers' && styles.chipTextOn]}>BORROWERS ({borrowers.length})</Text>
          </Pressable>
          <Pressable onPress={() => setLayer('outbreaks')} style={[styles.chip, layer === 'outbreaks' && styles.chipOn]}>
            <Text style={[styles.chipText, layer === 'outbreaks' && styles.chipTextOn]}>OUTBREAKS ({outbreaks.length})</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {points.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>
              {layer === 'borrowers'
                ? 'No borrowers with GPS coordinates yet.'
                : 'No outbreaks in the last 30 days.'}
            </Text>
          </View>
        ) : (
          <View style={styles.mapBox}>
            <GoogleMap
              points={points}
              height={420}
              display="points"
              mapType="standard"
            />
          </View>
        )}

        {layer === 'outbreaks' && outbreaks.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>OUTBREAK CENTROIDS</Text>
            {(data.outbreaks || []).map((o: any, i: number) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>{o.disease}</Text>
                <Text style={styles.cardMeta}>{o.count} scans · centroid {Number(o.lat).toFixed(3)}, {Number(o.lng).toFixed(3)}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chip: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  empty: { padding: 30, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  mapBox: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: p.borderHi },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  card: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 6, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 10, color: p.textMuted, marginTop: 3 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
