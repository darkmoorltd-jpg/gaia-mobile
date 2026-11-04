import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTheme } from '../theme';
import { supabase } from '../api/supabase';

interface Props {
  batchId: string;
  height?: number;
}

export default function DriverRouteMap({ batchId, height = 260 }: Props) {
  const { palette } = useTheme();
  const [points, setPoints] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!batchId) { setBusy(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('driver_locations')
          .select('lat, lon, speed_kmh, recorded_at')
          .eq('batch_id', batchId)
          .order('recorded_at', { ascending: true });
        setPoints(data || []);
      } catch {}
      setBusy(false);
    })();
  }, [batchId]);

  if (busy) {
    return (
      <View style={[styles.center, { height }]}>
        <ActivityIndicator color={palette.neon} />
        <Text style={{ color: '#666', fontSize: 11, marginTop: 8 }}>Loading route…</Text>
      </View>
    );
  }

  if (points.length === 0) {
    return (
      <View style={[styles.center, { height }]}>
        <Text style={{ fontSize: 36 }}>🚚</Text>
        <Text style={{ color: '#666', fontSize: 12, marginTop: 8 }}>No GPS trail yet for this batch</Text>
        <Text style={{ color: '#444', fontSize: 10, marginTop: 4 }}>Driver must toggle Live Tracking</Text>
      </View>
    );
  }

  const coords = points.map(p => ({ latitude: Number(p.lat), longitude: Number(p.lon) }));
  const first = coords[0];
  const last = coords[coords.length - 1];

  const latDelta = Math.max(0.08, Math.abs(first.latitude - last.latitude) * 1.6);
  const lonDelta = Math.max(0.08, Math.abs(first.longitude - last.longitude) * 1.6);

  const avgSpeed = points.reduce((s, p) => s + (Number(p.speed_kmh) || 0), 0) / points.length;
  const lastSpeed = Number(points[points.length - 1]?.speed_kmh) || 0;

  return (
    <View style={{ height, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: (first.latitude + last.latitude) / 2,
          longitude: (first.longitude + last.longitude) / 2,
          latitudeDelta: latDelta,
          longitudeDelta: lonDelta,
        }}
      >
        {coords.length > 1 ? (
          <Polyline coordinates={coords} strokeColor="#00ff88" strokeWidth={4} />
        ) : null}
        <Marker coordinate={first} title="Start" description="Origin" pinColor="#3b82f6" />
        <Marker
          coordinate={last}
          title="Latest position"
          description={`Speed: ${lastSpeed.toFixed(0)} km/h`}
          pinColor="#00ff88"
        />
      </MapView>

      <View style={styles.overlay}>
        <View style={styles.overlayRow}>
          <Text style={styles.overlayLbl}>GPS POINTS</Text>
          <Text style={styles.overlayVal}>{points.length}</Text>
        </View>
        <View style={styles.overlayRow}>
          <Text style={styles.overlayLbl}>AVG SPEED</Text>
          <Text style={styles.overlayVal}>{avgSpeed.toFixed(0)} km/h</Text>
        </View>
        <View style={styles.overlayRow}>
          <Text style={styles.overlayLbl}>LATEST</Text>
          <Text style={styles.overlayVal}>{lastSpeed.toFixed(0)} km/h</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  overlay: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 10, padding: 10, gap: 4,
  },
  overlayRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', alignItems: 'center' },
  overlayLbl: { fontSize: 9, color: '#888', fontWeight: '800', letterSpacing: 1 },
  overlayVal: { fontSize: 11, color: '#00ff88', fontWeight: '900' },
});
