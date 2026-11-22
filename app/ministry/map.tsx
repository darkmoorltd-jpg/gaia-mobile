import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const geojsonToCoords = (geojson: any): { latitude: number; longitude: number }[] => {
  if (!geojson || !Array.isArray(geojson.coordinates)) return [];
  const ring = geojson.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 3) return [];
  return ring
    .map(([lon, lat]: any) => ({ latitude: Number(lat), longitude: Number(lon) }))
    .filter((c: any) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
};

const colorsForHealth = (health: string | null): { fill: string; stroke: string } => {
  if (health === 'healthy') return { fill: 'rgba(0,255,136,0.25)', stroke: '#00ff88' };
  if (health === 'moderate') return { fill: 'rgba(255,179,0,0.25)', stroke: '#ffb300' };
  if (health === 'poor' || health === 'critical') return { fill: 'rgba(255,59,92,0.25)', stroke: '#ff3b5c' };
  return { fill: 'rgba(136,153,166,0.15)', stroke: '#8899a6' };
};

export default function MinistryMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showPins, setShowPins] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('ministry_farmers_list', {
        p_state_filter: null,
        p_search: null,
        p_limit: 1000,
        p_offset: 0,
      });
      const rows = (data?.rows || []).filter((f: any) =>
        f.latest_ndvi_health || f.farm_polygon_geojson || f.gps_lat,
      );
      setFarmers(rows);
      setBusy(false);
    })();
  }, []);

  const withLocation = farmers.filter(f => f.polygon_centroid_lat || f.gps_lat);
  const withPolygon = farmers
    .map(f => ({
      farmer: f,
      coords: geojsonToCoords(f.farm_polygon_geojson),
    }))
    .filter(x => x.coords.length >= 3);

  const getMarkerCoord = (f: any) => {
    const lat = Number(f.polygon_centroid_lat || f.gps_lat);
    const lon = Number(f.polygon_centroid_lon || f.gps_lon);
    return { latitude: lat, longitude: lon };
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.obsidian }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: palette.textMuted, letterSpacing: 1.5 }}>BACK</Text>
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: '900', color: palette.text, marginTop: 8 }}>Farmer Map</Text>
        <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>
          {withLocation.length} located · {withPolygon.length} with polygon · {farmers.length} total
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable
            onPress={() => setShowPins(p => !p)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: showPins ? palette.neon : palette.surface, borderWidth: 1, borderColor: showPins ? palette.neon : palette.border, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: showPins ? '#000' : palette.textMuted, letterSpacing: 1 }}>
              📍 PINS {showPins ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowPolygons(p => !p)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: showPolygons ? palette.neon : palette.surface, borderWidth: 1, borderColor: showPolygons ? palette.neon : palette.border, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: showPolygons ? '#000' : palette.textMuted, letterSpacing: 1 }}>
              🌾 POLYGONS {showPolygons ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#00ff88' }} />
            <Text style={{ fontSize: 9, color: palette.textMuted, fontWeight: '700' }}>HEALTHY</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ffb300' }} />
            <Text style={{ fontSize: 9, color: palette.textMuted, fontWeight: '700' }}>MODERATE</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ff3b5c' }} />
            <Text style={{ fontSize: 9, color: palette.textMuted, fontWeight: '700' }}>POOR</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#8899a6' }} />
            <Text style={{ fontSize: 9, color: palette.textMuted, fontWeight: '700' }}>NO DATA</Text>
          </View>
        </View>
      </View>

      {busy ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.neon} size="large" />
        </View>
      ) : (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: 9.0765, longitude: 8.6753, latitudeDelta: 8, longitudeDelta: 8 }}
        >
          {/* Polygons first — they render below markers */}
          {showPolygons && withPolygon.map((item, i) => {
            const c = colorsForHealth(item.farmer.latest_ndvi_health);
            return (
              <Polygon
                key={`poly-${item.farmer.user_id || i}`}
                coordinates={item.coords}
                fillColor={c.fill}
                strokeColor={c.stroke}
                strokeWidth={2}
              />
            );
          })}

          {/* Markers on top */}
          {showPins && withLocation.map((f, i) => {
            const c = colorsForHealth(f.latest_ndvi_health);
            return (
              <Marker
                key={`marker-${f.user_id || i}`}
                coordinate={getMarkerCoord(f)}
                title={f.full_name}
                description={`${f.state || '—'} · ${f.latest_ndvi_health || 'no data'}`}
                pinColor={c.stroke}
                onCalloutPress={() => router.push(`/farmer/${f.user_id}` as any)}
              />
            );
          })}
        </MapView>
      )}
    </View>
  );
}
