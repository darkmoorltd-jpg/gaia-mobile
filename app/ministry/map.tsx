import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';
import MinistryLeafletMap from '../../src/components/MinistryLeafletMap';

export default function MinistryMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [farmers, setFarmers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('ministry_farmers_list', {
        p_state_filter: null,
        p_search: null,
        p_limit: 2000,
        p_offset: 0,
      });
      if (err) throw err;
      const rows = (data?.rows || []).filter((f: any) =>
        f.latest_ndvi_health || f.farm_polygon_geojson || f.gps_lat
      );
      setFarmers(rows);
      if (rows.length === 0) {
        setError('No farmers with location data yet. Ask your agents to register farmers with GPS + polygon.');
      }
    } catch (e: any) {
      setError(e.message || 'Load failed');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const withLocation = farmers.filter(f =>
    f.farm_polygon_geojson || f.gps_lat || f.polygon_centroid_lat
  );
  const withPolygon = farmers.filter(f => f.farm_polygon_geojson);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Farmer Map</Text>
        <Text style={styles.sub}>
          {withLocation.length} located · {withPolygon.length} with polygon
        </Text>

        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setShowPins(p => !p)}
            style={[styles.toggle, showPins && styles.toggleOn]}
          >
            <Text style={[styles.toggleTxt, showPins && styles.toggleTxtOn]}>
              📍 PINS {showPins ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowPolygons(p => !p)}
            style={[styles.toggle, showPolygons && styles.toggleOn]}
          >
            <Text style={[styles.toggleTxt, showPolygons && styles.toggleTxtOn]}>
              🌾 POLYGONS {showPolygons ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#00ff88' }]} /><Text style={styles.legendTxt}>HEALTHY</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#ffb300' }]} /><Text style={styles.legendTxt}>MODERATE</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#ff3b5c' }]} /><Text style={styles.legendTxt}>POOR</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#8899a6' }]} /><Text style={styles.legendTxt}>NO DATA</Text></View>
        </View>
      </View>

      {busy ? (
        <View style={styles.center}><ActivityIndicator size="large" color={palette.neon} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTxt}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>RETRY</Text>
          </Pressable>
        </View>
      ) : (
        <MinistryLeafletMap
          farmers={farmers}
          showPins={showPins}
          showPolygons={showPolygons}
          onFarmerPress={(userId) => router.push(`/farmer/${userId}` as any)}
        />
      )}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  toggle: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  toggleOn: { backgroundColor: p.neon, borderColor: p.neon },
  toggleTxt: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 0.5 },
  toggleTxtOn: { color: '#000' },
  legend: { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 2 },
  legendTxt: { fontSize: 9, color: p.textMuted, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorTxt: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: p.neon },
  retryTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1 },
});
