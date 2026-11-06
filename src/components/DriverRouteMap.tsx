import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { supabase } from '../api/supabase';
import { useTheme } from '../theme';

export default function DriverRouteMap({ batchId, height = 200 }: { batchId: string, height?: number }) {
  const { palette } = useTheme();
  const [points, setPoints] = useState<{lat: number, lon: number}[]>([]);

  useEffect(() => {
    if (!batchId) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('lat, lon')
        .eq('batch_id', batchId)
        .order('created_at');
      if (mounted && data) setPoints(data);
    };
    load();
    
    // Realtime update
    const sub = supabase.channel('loc-' + batchId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `batch_id=eq.${batchId}` }, 
      (payload) => setPoints((prev) => [...prev, payload.new as any]))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(sub); };
  }, [batchId]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height, backgroundColor: palette.surface }]}>
        <Text style={{ color: palette.textMuted, fontSize: 12 }}>No GPS data yet</Text>
      </View>
    );
  }

  const coords = points.map(p => ({ latitude: p.lat, longitude: p.lon }));
  const current = coords[coords.length - 1];

  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ ...current, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Polyline coordinates={coords} strokeColor={palette.neon} strokeWidth={4} />
        <Marker coordinate={current} pinColor={palette.neon} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
