import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

export default function MinistryMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('ministry_farmers_list', { p_state_filter: null, p_search: null, p_limit: 1000, p_offset: 0 });
      const rows = (data?.rows || []).filter((f: any) => f.latest_ndvi_health || f.farm_polygon_geojson);
      setFarmers(rows);
      setBusy(false);
    })();
  }, []);

  const withGps = farmers.filter(f => f.polygon_centroid_lat || f.gps_lat);

  return (
    <View style={{ flex: 1, backgroundColor: palette.obsidian }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()}><Text style={{ fontSize: 11, fontWeight: '800', color: palette.textMuted, letterSpacing: 1.5 }}>BACK</Text></Pressable>
        <Text style={{ fontSize: 26, fontWeight: '900', color: palette.text, marginTop: 8 }}>Farmer Map</Text>
        <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>{withGps.length} farmers with location</Text>
      </View>
      {busy ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.neon} /></View> : (
        <MapView style={{ flex: 1 }} initialRegion={{ latitude: 9.0765, longitude: 8.6753, latitudeDelta: 8, longitudeDelta: 8 }}>
          {withGps.map((f: any, i: number) => {
            const lat = Number(f.polygon_centroid_lat || f.gps_lat);
            const lon = Number(f.polygon_centroid_lon || f.gps_lon);
            const color = f.latest_ndvi_health === 'healthy' ? '#00ff88' : f.latest_ndvi_health === 'poor' ? '#ffb300' : '#8899a6';
            return <Marker key={i} coordinate={{ latitude: lat, longitude: lon }} title={f.full_name} description={`${f.state} · ${f.latest_ndvi_health || 'no data'}`} pinColor={color} onCalloutPress={() => router.push(`/ministry/farmer/${f.user_id}` as any)} />;
          })}
        </MapView>
      )}
    </View>
  );
}
