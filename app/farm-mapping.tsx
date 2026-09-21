import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { WebView } from 'react-native-webview';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

export default function FarmMapping() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [points, setPoints] = useState<any[]>([]);
  const [areaM2, setAreaM2] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<any>(null);
  const [maps, setMaps] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'GAIA uses GPS to map your farm.');
        return;
      }
      loadMaps();
    })();
  }, []);

  const loadMaps = async () => {
    if (!user) return;
    const { data } = await supabase.from('farm_maps')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setMaps(data || []);
  };

  const startTracking = async () => {
    setTracking(true);
    setPoints([]);
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 3 },
      (loc) => {
        const p = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setCurrentPos(p);
        setPoints((prev) => {
          const next = [...prev, p];
          if (next.length >= 3) {
            try {
              const poly = turf.polygon([[...next.map((x) => [x.lon, x.lat]), [next[0].lon, next[0].lat]]]);
              setAreaM2(turf.area(poly));
            } catch {}
          }
          return next;
        });
      }
    );
    return () => sub.remove();
  };

  const stopTracking = () => {
    setTracking(false);
    if (points.length >= 3) saveMap();
  };

  const saveMap = async () => {
    if (!user) return;
    const acres = areaM2 / 4046.86;
    await supabase.from('farm_maps').insert({
      user_id: user.id,
      boundary: JSON.stringify(points),
      area_sqm: areaM2,
      area_acres: acres,
      label: 'Field ' + new Date().toLocaleDateString(),
    });
    loadMaps();
    Alert.alert('Saved', acres.toFixed(2) + ' acres mapped');
  };

  const acres = areaM2 / 4046.86;
  const hectares = areaM2 / 10000;

  const html = currentPos ? `
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>body{margin:0}#map{height:100vh}</style></head>
    <body><div id="map"></div><script>
    var map = L.map('map').setView([${currentPos.lat}, ${currentPos.lon}], 18);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.circleMarker([${currentPos.lat}, ${currentPos.lon}], {radius:6,color:'#00ff88'}).addTo(map);
    var pts = ${JSON.stringify(points.map((p) => [p.lat, p.lon]))};
    if (pts.length >= 3) L.polygon(pts, {color:'#00ff88'}).addTo(map);
    </script></body></html>
  ` : '';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Farm Tools" />
        <Text style={styles.title}>Farm Mapping</Text>
        <Text style={styles.subtitle}>Walk the perimeter — GAIA calculates the area</Text>

        {currentPos ? (
          <View style={styles.mapWrap}>
            <WebView source={{ html }} style={styles.map} />
          </View>
        ) : (
          <GlassCard><Text style={styles.hint}>Tap Start to begin</Text></GlassCard>
        )}

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{acres.toFixed(2)}</Text>
            <Text style={styles.statLbl}>ACRES</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{hectares.toFixed(2)}</Text>
            <Text style={styles.statLbl}>HECTARES</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{points.length}</Text>
            <Text style={styles.statLbl}>POINTS</Text>
          </View>
        </View>

        <NeonButton label={tracking ? 'STOP & SAVE' : 'START WALKING'} onPress={tracking ? stopTracking : startTracking} />

        {maps.length > 0 ? (
          <>
            <Text style={styles.section}>SAVED FIELDS</Text>
            {maps.map((m) => (
              <GlassCard key={m.id} style={{ marginBottom: 8 }}>
                <Text style={styles.fieldName}>{m.label}</Text>
                <Text style={styles.fieldArea}>{m.area_acres.toFixed(2)} acres</Text>
              </GlassCard>
            ))}
          </>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: 6, marginBottom: 20 },
  mapWrap: { height: 300, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: p.borderHi },
  map: { flex: 1, backgroundColor: p.abyss },
  hint: { color: p.textMuted, textAlign: 'center', padding: 40 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stat: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 10, fontWeight: '600', color: p.textMuted, marginTop: 4 },
  section: { ...typography.micro, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  fieldName: { color: p.text, fontWeight: '700' },
  fieldArea: { color: p.neon, fontWeight: '800', marginTop: 4 },
});
