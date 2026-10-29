import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { tap as hapticTap } from '../src/utils/haptics';

const SOILGRIDS_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const ARCGIS_URL = 'https://services.arcgis.com/P8Cok4qAP1sTVE59/ArcGIS/rest/services/Nigeria_soils_data/FeatureServer/0/query';

interface IsricResult {
  ph05: number | null; ph515: number | null;
  soc05: number | null; soc515: number | null;
  clay05: number | null; sand05: number | null; silt05: number | null;
  cec05: number | null; nitrogen05: number | null;
}

interface ArcGisResult {
  ph: number | null; n: number | null; p: number | null; k: number | null;
  oc: number | null; ca: number | null; mg: number | null;
  depth: string | null; project: string | null;
}

const conv = {
  ph: (v: number) => v / 10, soc: (v: number) => v / 10,
  clay: (v: number) => v / 10, sand: (v: number) => v / 10,
  silt: (v: number) => v / 10, cec: (v: number) => v / 10,
  nitrogen: (v: number) => v / 100,
};

function pHInterpretation(ph: number | null): string {
  if (ph === null) return '';
  if (ph < 5.5) return 'Strongly acidic — add lime';
  if (ph < 6.0) return 'Acidic — add lime before planting';
  if (ph <= 7.0) return 'Optimal for most crops';
  if (ph <= 7.5) return 'Slightly alkaline';
  return 'Alkaline — add organic matter';
}

function soilTexture(clay: number | null, sand: number | null, silt: number | null): string {
  if (clay === null || sand === null || silt === null) return '';
  if (clay > 40) return 'Clay';
  if (sand > 70) return 'Sandy';
  if (silt > 50) return 'Silty';
  if (clay > 25) return 'Clay Loam';
  if (sand > 50) return 'Sandy Loam';
  return 'Loam';
}

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
      if (status !== 'granted') {
        setError('Location permission required to fetch soil data.');
        setBusy(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setLocation({ lat, lon });

      // 1. ISRIC SoilGrids
      const properties = ['phh2o', 'soc', 'clay', 'sand', 'silt', 'cec', 'nitrogen'];
      const depths = ['0-5cm', '5-15cm'];
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
          ph515: getVal('phh2o', '5-15cm', conv.ph),
          soc05: getVal('soc', '0-5cm', conv.soc),
          soc515: getVal('soc', '5-15cm', conv.soc),
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
      setError(e?.message || 'Failed to fetch soil data. Check internet.');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const texture = soilTexture(isric?.clay05 ?? null, isric?.sand05 ?? null, isric?.silt05 ?? null);
  const phInterp = pHInterpretation(isric?.ph05 ?? null);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>🏞️ Soil by GPS</Text>
        <Text style={styles.subtitle}>Real soil chemistry from ISRIC SoilGrids + IITA Nigeria</Text>

        {location ? (
          <Text style={styles.coords}>📍 {location.lat.toFixed(4)}, {location.lon.toFixed(4)}</Text>
        ) : null}

        {busy ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.neon} size="large" />
            <Text style={styles.busyText}>Fetching soil data for your field…</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isric ? (
          <>
            <Text style={styles.sectionLabel}>🌍 GLOBAL SOIL DATA (ISRIC)</Text>
            <View style={styles.card}>
              <View style={styles.row}><Text style={styles.label}>pH (0–5cm)</Text><Text style={styles.value}>{isric.ph05 !== null ? isric.ph05.toFixed(1) : '—'}{phInterp ? ` (${phInterp})` : ''}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Organic Carbon</Text><Text style={styles.value}>{isric.soc05 !== null ? `${isric.soc05.toFixed(1)} g/kg` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Nitrogen</Text><Text style={styles.value}>{isric.nitrogen05 !== null ? `${isric.nitrogen05.toFixed(2)} g/kg` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Texture</Text><Text style={styles.value}>{texture || '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Clay / Sand / Silt</Text><Text style={styles.value}>{isric.clay05 !== null ? `${isric.clay05.toFixed(0)}%` : '—'} / {isric.sand05 !== null ? `${isric.sand05.toFixed(0)}%` : '—'} / {isric.silt05 !== null ? `${isric.silt05.toFixed(0)}%` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>CEC</Text><Text style={styles.value}>{isric.cec05 !== null ? `${isric.cec05.toFixed(1)} cmol/kg` : '—'}</Text></View>
            </View>
          </>
        ) : null}

        {arcgis ? (
          <>
            <Text style={styles.sectionLabel}>🇳🇬 NIGERIA SAMPLE DATA (IITA)</Text>
            <View style={styles.card}>
              <Text style={styles.projectText}>Project: {arcgis.project || 'Unknown'}</Text>
              <Text style={styles.depthText}>Depth: {arcgis.depth || '—'}</Text>
              <View style={styles.row}><Text style={styles.label}>pH</Text><Text style={styles.value}>{arcgis.ph !== null ? arcgis.ph.toFixed(1) : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Nitrogen (N)</Text><Text style={styles.value}>{arcgis.n !== null ? `${arcgis.n} mg/kg` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Phosphorus (P)</Text><Text style={styles.value}>{arcgis.p !== null ? `${arcgis.p} mg/kg` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Potassium (K)</Text><Text style={styles.value}>{arcgis.k !== null ? `${arcgis.k} cmol/kg` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Organic Carbon</Text><Text style={styles.value}>{arcgis.oc !== null ? `${arcgis.oc} %` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Calcium (Ca)</Text><Text style={styles.value}>{arcgis.ca !== null ? `${arcgis.ca} cmol/kg` : '—'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Magnesium (Mg)</Text><Text style={styles.value}>{arcgis.mg !== null ? `${arcgis.mg} cmol/kg` : '—'}</Text></View>
            </View>
          </>
        ) : (
          !busy && location ? (
            <Text style={styles.noData}>No IITA soil sample recorded near this location. ISRIC data is still available above.</Text>
          ) : null
        )}

        <Pressable onPress={fetchAll} disabled={busy} style={[styles.refreshBtn, busy && { opacity: 0.5 }]}>
          <Text style={styles.refreshTxt}>REFRESH SOIL DATA</Text>
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
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 8 },
  coords: { fontSize: 12, color: p.neon, fontFamily: 'monospace', marginBottom: 20 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  busyText: { fontSize: 13, color: p.textMuted },
  error: { color: p.danger, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  label: { fontSize: 13, color: p.textMuted, flex: 1 },
  value: { fontSize: 13, fontWeight: '700', color: p.text, textAlign: 'right', flex: 1.2 },
  projectText: { fontSize: 11, color: p.textDim, marginBottom: 2 },
  depthText: { fontSize: 11, color: p.textDim, marginBottom: 12 },
  noData: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', marginTop: 16, textAlign: 'center' },
  refreshBtn: { marginTop: 24, paddingVertical: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  refreshTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
