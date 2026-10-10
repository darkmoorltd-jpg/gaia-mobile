import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface P { latitude: number; longitude: number; }
type ViewMode = 'standard' | 'satellite' | 'hybrid' | 'terrain';
type DisplayMode = 'line' | 'points';

interface Props {
  points: P[];
  center?: P;
  height?: number;
  closed?: boolean;
  mapType?: ViewMode;
  display?: DisplayMode;
}

export function MapLibreMap({
  points, center, height = 340, closed, mapType, display,
}: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Text style={styles.title}>MAP STUB ACTIVE</Text>
      <Text style={styles.meta}>points: {points.length}</Text>
      <Text style={styles.meta}>mapType: {mapType}</Text>
      <Text style={styles.meta}>display: {display}</Text>
      <Text style={styles.meta}>closed: {String(closed)}</Text>
      <Text style={styles.meta}>center: {center ? (center.latitude.toFixed(4) + ',' + center.longitude.toFixed(4)) : 'none'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#0a0e0c',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: { color: '#00ff88', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  meta: { color: '#8899a6', fontSize: 12, marginTop: 4 },
});
