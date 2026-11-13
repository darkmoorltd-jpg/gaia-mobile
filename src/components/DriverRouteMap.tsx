import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { supabase } from '../api/supabase';
import { useTheme } from '../theme';

interface Point { lat: number; lon: number; speed_kmh?: number; recorded_at?: string; }
interface Props { batchId: string; height?: number; destination?: { latitude: number; longitude: number; }; }

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export default function DriverRouteMap({ batchId, height = 200, destination }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [points, setPoints] = useState<Point[]>([]);
  const [, forceTick] = useState(0);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!batchId) return;
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('lat,lon,speed_kmh,recorded_at')
        .eq('batch_id', batchId)
        .order('recorded_at');
      if (mounted && data) setPoints(data as Point[]);
    };
    load();

    const sub = supabase
      .channel('loc-' + batchId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `batch_id=eq.${batchId}` },
        (payload) => setPoints((prev) => [...prev, payload.new as Point]))
      .subscribe();

    // Tick every second for "X seconds ago"
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);

    return () => { mounted = false; clearInterval(interval); supabase.removeChannel(sub); };
  }, [batchId]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height, backgroundColor: palette.surface }]}>
        <Text style={styles.emptyIcon}>🛰️</Text>
        <Text style={styles.emptyTitle}>Waiting for first GPS ping</Text>
        <Text style={styles.emptySub}>Driver hasn't enabled tracking yet</Text>
      </View>
    );
  }

  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lon }));
  const current = coords[coords.length - 1];
  const latest = points[points.length - 1];

  // Total distance traveled
  let totalKm = 0;
  for (let i = 1; i < points.length; i++) {
    totalKm += haversineKm(points[i - 1], points[i]);
  }

  // Speed display
  const speed = latest.speed_kmh ? Math.round(latest.speed_kmh) : null;

  // ETA
  let etaMinutes: number | null = null;
  let remainingKm: number | null = null;
  if (destination) {
    remainingKm = haversineKm(
      { lat: latest.lat, lon: latest.lon },
      { lat: destination.latitude, lon: destination.longitude },
    );
    const avgSpeed = speed && speed > 5 ? speed : 40;
    etaMinutes = Math.round((remainingKm / avgSpeed) * 60);
  }

  // Last ping seconds ago
  const lastPing = latest.recorded_at ? new Date(latest.recorded_at).getTime() : null;
  const secondsAgo = lastPing ? Math.max(0, Math.round((Date.now() - lastPing) / 1000)) : null;

  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          ...current, latitudeDelta: 0.05, longitudeDelta: 0.05,
        }}
        onMapReady={() => {
          if (coords.length > 1) {
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 40, right: 40, bottom: 100, left: 40 },
              animated: true,
            });
          }
        }}
        scrollEnabled
        zoomEnabled
      >
        <Polyline coordinates={coords} strokeColor={palette.neon} strokeWidth={4} />
        <Marker coordinate={current} pinColor={palette.neon} title="Driver" />
        {destination ? (
          <Marker coordinate={destination} pinColor="#ff3b5c" title="Destination" />
        ) : null}
      </MapView>

      {/* Floating overlay */}
      <View style={styles.overlay}>
        <View style={styles.row}>
          {speed !== null ? (
            <View style={styles.chip}>
              <Text style={styles.chipVal}>{speed}</Text>
              <Text style={styles.chipLbl}>km/h</Text>
            </View>
          ) : null}
          <View style={styles.chip}>
            <Text style={styles.chipVal}>{totalKm.toFixed(1)}</Text>
            <Text style={styles.chipLbl}>km traveled</Text>
          </View>
          {etaMinutes !== null ? (
            <View style={[styles.chip, { backgroundColor: 'rgba(255,179,0,0.15)' }]}>
              <Text style={[styles.chipVal, { color: '#ffb300' }]}>{etaMinutes}</Text>
              <Text style={styles.chipLbl}>min ETA</Text>
            </View>
          ) : null}
        </View>
        {secondsAgo !== null ? (
          <Text style={styles.updated}>
            {secondsAgo < 5 ? '🟢 LIVE' : `⚫ ${secondsAgo}s ago`}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          mapRef.current?.animateToRegion({
            ...current, latitudeDelta: 0.02, longitudeDelta: 0.02,
          }, 500);
        }}
        style={styles.followBtn}
      >
        <Text style={styles.followTxt}>📍</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (p: any) =>
  StyleSheet.create({
    empty: {
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 12, gap: 4,
    },
    emptyIcon: { fontSize: 32 },
    emptyTitle: { fontSize: 13, fontWeight: '700', color: p.textMuted },
    emptySub: { fontSize: 11, color: p.textDim },
    overlay: {
      position: 'absolute', bottom: 8, left: 8, right: 8,
      backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 10,
      paddingVertical: 8, paddingHorizontal: 10,
    },
    row: { flexDirection: 'row', gap: 6 },
    chip: {
      flex: 1, backgroundColor: 'rgba(0,255,136,0.15)',
      borderRadius: 8, paddingVertical: 6, alignItems: 'center',
    },
    chipVal: { fontSize: 14, fontWeight: '900', color: p.neon },
    chipLbl: { fontSize: 9, color: p.textMuted, marginTop: 1, letterSpacing: 0.5 },
    updated: { fontSize: 10, color: p.textDim, textAlign: 'right', marginTop: 6 },
    followBtn: {
      position: 'absolute', top: 8, right: 8,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center', justifyContent: 'center',
    },
    followTxt: { fontSize: 16 },
  });
