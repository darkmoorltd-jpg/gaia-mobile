import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';

const SOILGRIDS_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const ARCGIS_URL = 'https://services.arcgis.com/P8Cok4qAP1sTVE59/ArcGIS/rest/services/Nigeria_soils_data/FeatureServer/0/query';

interface IsricResult {
  ph05: number | null; soc05: number | null;
  clay05: number | null; sand05: number | null; silt05: number | null;
  cec05: number | null; nitrogen05: number | null;
}

interface ArcGisResult {
  ph: number | null; n: number | null; p: number | null; k: number | null;
  oc: number | null; ca: number | null; mg: number | null;
  depth: string | null; project: string | null;
}

const conv = { ph: (v: number) => v / 10, soc: (v: number) => v / 10, clay: (v: number) => v / 10, sand: (v: number) => v / 10, silt: (v: number) => v / 10, cec: (v: number) => v / 10, nitrogen: (v: number) => v / 100 };

// Visual Helper: pH Gauge
const phColor = (ph: number | null) => {
  if (ph === null) return '#888';
  if (ph < 5.5) return '#ff3b5c'; // Red
  if (ph < 6.0) return '#ff9800'; // Orange
  if (ph <= 7.0) return '#00ff88'; // Green
  if (ph <= 7.5) return '#2196f3'; // Blue
  return '#3f51b5'; // Deep Blue
};

// Visual Helper: Nutrient Bar
const nutrientPct = (val: number | null, ideal: number) => {
  if (val === null) return 0;
  return Math.min((val / ideal) * 100, 100);
};
const nutrientColor = (pct: number) => pct >= 70 ? '#00ff88' : pct >= 40 ? '#ffb300' : '#ff3b5c';

export default function SoilDataScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isric, setIsric] = useState<IsricResult | null>(null);
  const [arcgis, setArcgis] = useState<ArcGisResult | null>(null);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setBusy(true); setError(''); setIsric(null); setArcgis(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission required.'); setBusy(false); return; }
      
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setLocation({ lat, lon });

      // 1. ISRIC SoilGrids
      const properties = ['phh2o', 'soc', 'clay', 'sand', 'silt', 'cec', 'nitrogen'];
      const depths = ['0-5cm'];
      const isricParams = new URLSearchParams();
      isricParams.append('lon', String(lon));
      isricParams.append('lat', String(lat));
      properties.forEach(p => isricParams.append('property', p));
      depths.forEach(d => isricParams.append('depth', d));
      isricParams.append('value', 'mean');

      const isricRes = await fetch(`${SOILGRIDS_URL}?${isricParams.toString()}`);
      if (isricRes.ok) {
        const data = await isricRes.json();
        const layers = data?.properties?.layers || [];
        const getVal = (name: string, depth: string, converter: (v: number) => number) => {
          const layer = layers.find((l: any) => l.name === name);
          if (!layer) return null;
          const d = layer.depths?.find((x: any) => x.label === depth);
          const raw = d?.values?.mean;
          return typeof raw === 'number' ? converter(raw) : null;
        };
        setIsric({
          ph05: getVal('phh2o', '0-5cm', conv.ph),
          soc05: getVal('soc', '0-5cm', conv.soc),
          clay05: getVal('clay', '0-5cm', conv.clay),
          sand05: getVal('sand', '0-5cm', conv.sand),
          silt05: getVal('silt', '0-5cm', conv.silt),
          cec05: getVal('cec', '0-5cm', conv.cec),
          nitrogen05: getVal('nitrogen', '0-5cm', conv.nitrogen),
        });
      }

      // 2. IITA Nigeria ArcGIS
      const arcgisParams = new URLSearchParams({
        where: '1=1', outFields: '*', f: 'json',
        geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint',
        inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      });
      const arcgisRes = await fetch(`${ARCGIS_URL}?${arcgisParams.toString()}`);
      if (arcgisRes.ok) {
        const data = await arcgisRes.json();
        if (data.features && data.features.length > 0) {
          const attr = data.features[0].attributes;
          setArcgis({
            ph: attr.pH ?? null, n: attr.N ?? null, p: attr.P ?? null, k: attr.K ?? null,
            oc: attr.OC ?? null, ca: attr.Ca ?? null, mg: attr.Mg ?? null,
            depth: attr.Depth ?? null, project: attr.project ?? null,
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch soil data.');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>🏞️ Soil Chemistry</Text>
        {location ? <Text style={styles.coords}>📍 {location.lat.toFixed(4)}, {location.lon.toFixed(4)}</Text> : null}

        {busy ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.neon} size="large" />
            <Text style={styles.busyText}>Fetching soil data…</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* ISRIC VISUALS */}
        {isric ? (
          <>
            <Text style={styles.sectionLabel}>🌍 SOIL PROPERTIES (0–5cm)</Text>
            <View style={styles.card}>
              
              {/* pH VISUAL GAUGE */}
              <View style={styles.visualBlock}>
                <View style={styles.visualHeader}>
                  <Text style={styles.visualLabel}>pH Level</Text>
                  <Text style={[styles.visualValue, { color: phColor(isric.ph05) }]}>
                    {isric.ph05?.toFixed(1) || '—'}
                  </Text>
                </View>
                <View style={styles.gaugeTrack}>
                  <View style={[styles.gaugeSegment, { flex: 1, backgroundColor: '#ff3b5c' }]} />
                  <View style={[styles.gaugeSegment, { flex: 1, backgroundColor: '#ff9800' }]} />
                  <View style={[styles.gaugeSegment, { flex: 1, backgroundColor: '#00ff88' }]} />
                  <View style={[styles.gaugeSegment, { flex: 1, backgroundColor: '#2196f3' }]} />
                  {isric.ph05 !== null && (
                    <View style={[styles.gaugeMarker, { left: `${Math.min(Math.max((isric.ph05 / 14) * 100, 0), 98)}%` }]} />
                  )}
                </View>
                <View style={styles.gaugeLabels}>
                  <Text style={styles.gaugeLabelText}>0 (Acidic)</Text>
                  <Text style={styles.gaugeLabelText}>7 (Neutral)</Text>
                  <Text style={styles.gaugeLabelText}>14 (Alkaline)</Text>
                </View>
              </View>

              {/* TEXTURE STACKED BAR */}
              <View style={styles.visualBlock}>
                <View style={styles.visualHeader}>
                  <Text style={styles.visualLabel}>Soil Texture</Text>
                  <Text style={styles.visualValue}>
                    {isric.clay05 ? `${Math.round(isric.clay05)}% Clay` : '—'}
                  </Text>
                </View>
                <View style={styles.textureTrack}>
                  <View style={[styles.textureSegment, { flex: isric.sand05 || 0, backgroundColor: '#ffb300' }]} />
                  <View style={[styles.textureSegment, { flex: isric.silt05 || 0, backgroundColor: '#8899a6' }]} />
                  <View style={[styles.textureSegment, { flex: isric.clay05 || 0, backgroundColor: '#c68a5c' }]} />
                </View>
                <View style={styles.textureLabels}>
                  <Text style={styles.textureLabelText}>Sand {Math.round(isric.sand05 || 0)}%</Text>
                  <Text style={styles.textureLabelText}>Silt {Math.round(isric.silt05 || 0)}%</Text>
                  <Text style={styles.textureLabelText}>Clay {Math.round(isric.clay05 || 0)}%</Text>
                </View>
              </View>

              {/* NUTRIENT BARS */}
              <View style={styles.visualBlock}>
                <Text style={styles.visualLabel}>Nitrogen (N)</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${nutrientPct(isric.nitrogen05, 2.0)}%`, backgroundColor: nutrientColor(nutrientPct(isric.nitrogen05, 2.0)) }]} />
                </View>
                <Text style={styles.barValueText}>{isric.nitrogen05?.toFixed(2) || '—'} g/kg</Text>
              </View>

              <View style={styles.visualBlock}>
                <Text style={styles.visualLabel}>Organic Carbon</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${nutrientPct(isric.soc05, 20)}%`, backgroundColor: nutrientColor(nutrientPct(isric.soc05, 20)) }]} />
                </View>
                <Text style={styles.barValueText}>{isric.soc05?.toFixed(1) || '—'} g/kg</Text>
              </View>
            </View>
          </>
        ) : null}

        {/* IITA VISUALS */}
        {arcgis ? (
          <>
            <Text style={styles.sectionLabel}>🇳🇬 SAMPLE DATA (IITA)</Text>
            <View style={styles.card}>
              <Text style={styles.projectText}>{arcgis.project || 'Unknown Project'}</Text>
              
              <View style={styles.visualBlock}>
                <View style={styles.visualHeader}>
                  <Text style={styles.visualLabel}>Phosphorus (P)</Text>
                  <Text style={[styles.visualValue, { color: nutrientColor(nutrientPct(arcgis.p, 15)) }]}>{arcgis.p ?? '—'} mg/kg</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${nutrientPct(arcgis.p, 15)}%`, backgroundColor: nutrientColor(nutrientPct(arcgis.p, 15)) }]} />
                </View>
              </View>

              <View style={styles.visualBlock}>
                <View style={styles.visualHeader}>
                  <Text style={styles.visualLabel}>Potassium (K)</Text>
                  <Text style={[styles.visualValue, { color: nutrientColor(nutrientPct(arcgis.k, 0.2)) }]}>{arcgis.k ?? '—'} cmol/kg</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${nutrientPct(arcgis.k, 0.2)}%`, backgroundColor: nutrientColor(nutrientPct(arcgis.k, 0.2)) }]} />
                </View>
              </View>
            </View>
          </>
        ) : null}

        <Pressable onPress={fetchAll} disabled={busy} style={[styles.refreshBtn, busy && { opacity: 0.5 }]}>
          <Text style={styles.refreshTxt}>REFRESH</Text>
        </Pressable>
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  coords: { fontSize: 12, color: p.neon, fontFamily: 'monospace', marginBottom: 20, marginTop: 4 },
  center: { alignItems: 'center', paddingVertical: 40 },
  busyText: { fontSize: 13, color: p.textMuted, marginTop: 10 },
  error: { color: p.danger, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: p.border },
  
  visualBlock: { marginBottom: 20 },
  visualHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  visualLabel: { fontSize: 13, fontWeight: '700', color: p.textMuted },
  visualValue: { fontSize: 14, fontWeight: '900', color: p.text },
  
  gaugeTrack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 6, position: 'relative' },
  gaugeSegment: { height: '100%' },
  gaugeMarker: { position: 'absolute', top: -2, bottom: -2, width: 4, backgroundColor: '#fff', borderRadius: 2 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  gaugeLabelText: { fontSize: 9, color: p.textDim },

  textureTrack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 6 },
  textureSegment: { height: '100%' },
  textureLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  textureLabelText: { fontSize: 9, color: p.textDim },

  barTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', borderRadius: 4 },
  barValueText: { fontSize: 11, color: p.text, textAlign: 'right', fontWeight: '600' },

  projectText: { fontSize: 12, color: p.neon, fontWeight: '700', marginBottom: 16 },
  refreshBtn: { marginTop: 24, paddingVertical: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  refreshTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
