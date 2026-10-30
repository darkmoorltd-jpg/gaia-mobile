import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function AgentFieldMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await supabase.rpc('agent_my_farmers', { p_filter: 'all', p_search: null, p_limit: 300 });
      if (!r.error && r.data) {
        const withGps = r.data.filter((f: any) => f.gps_lat && f.gps_lon);
        setFarmers(withGps);
      }
      setBusy(false);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>🗺️ Field Map</Text>
        <Text style={styles.sub}>{farmers.length} farmers mapped</Text>
      </View>

      {busy ? (
        <View style={styles.center}><ActivityIndicator color={palette.neon} size="large" /></View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: farmers[0]?.gps_lat || 9.0765,
            longitude: farmers[0]?.gps_lon || 7.3986,
            latitudeDelta: 2.5,
            longitudeDelta: 2.5,
          }}
        >
          {farmers.map((f, i) => (
            <Marker
              key={i}
              coordinate={{ latitude: Number(f.gps_lat), longitude: Number(f.gps_lon) }}
              title={f.name}
              description={f.crop || 'Farmer'}
              pinColor={f.bucket === 'approved' ? '#00ff88' : '#ffb300'}
            />
          ))}
        </MapView>
      )}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: p.obsidian, zIndex: 10 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1 },
});
