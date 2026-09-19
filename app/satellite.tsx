import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';

const API = 'https://gaia-api-xuly.onrender.com';

type Layer = 'TRUE_COLOR' | 'NDVI' | 'MOISTURE';

export default function Satellite() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [layer, setLayer] = useState<Layer>('TRUE_COLOR');
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const load = async (lat: number, lon: number, l: Layer) => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const url = `${API}/satellite/tile?lat=${lat}&lon=${lon}&layer=${l}`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => setImgUri(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e: any) {
      Alert.alert('Satellite error', e?.message || 'Could not load tile');
    } finally {
      setBusy(false);
    }
  };

  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Location access is needed to load satellite imagery');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const c = { lat: loc.coords.latitude, lon: loc.coords.longitude };
    setCoords(c);
    load(c.lat, c.lon, layer);
  };

  useEffect(() => { locate(); }, []);
  useEffect(() => { if (coords) load(coords.lat, coords.lon, layer); }, [layer]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>SATELLITE MONITOR</Text>
        <Text style={styles.title}>Field Monitor</Text>
        {coords ? (
          <Text style={styles.sub}>{coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}</Text>
        ) : (
          <Text style={styles.sub}>Getting your location…</Text>
        )}

        <View style={styles.mapBox}>
          {busy ? (
            <View style={styles.mapLoading}><ActivityIndicator color={palette.neon} /></View>
          ) : imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.map} />
          ) : (
            <View style={styles.mapLoading}>
              <Text style={styles.mapText}>No imagery loaded</Text>
              <Pressable onPress={locate} style={styles.retryBtn}>
                <Text style={styles.retryTxt}>RETRY</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.chips}>
          {(['TRUE_COLOR', 'NDVI', 'MOISTURE'] as Layer[]).map((l) => (
            <Pressable
              key={l}
              onPress={() => setLayer(l)}
              style={[styles.chip, layer === l && styles.chipActive]}
            >
              <Text style={[styles.chipTxt, layer === l && styles.chipTxtActive]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.legend}>
          {layer === 'TRUE_COLOR' && 'Real color from Sentinel-2 L2A'}
          {layer === 'NDVI' && 'NDVI — bright = healthy vegetation'}
          {layer === 'MOISTURE' && 'NDMI — moisture index'}
        </Text>

        <Pressable onPress={locate} style={styles.cta}>
          <Text style={styles.ctaTxt}>REFRESH TILE</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4 },
  mapBox: {
    aspectRatio: 1, marginTop: 18, borderRadius: 24, overflow: 'hidden',
    backgroundColor: p.abyss, borderWidth: 1, borderColor: p.border, position: 'relative',
  },
  map: { width: '100%', height: '100%' },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mapText: { color: p.textMuted, fontSize: 13 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: p.borderHi },
  retryTxt: { color: p.neon, fontWeight: '800', letterSpacing: 1.5, fontSize: 11 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  chipActive: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  chipTxt: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTxtActive: { color: p.neon },
  legend: { fontSize: 12, color: p.textMuted, marginTop: 12, textAlign: 'center' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 22 },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
