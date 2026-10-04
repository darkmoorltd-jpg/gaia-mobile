import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useLocation } from '../store/location';

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

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e0c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a5350' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2820' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#7a8884' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#00ff88' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#4a5350' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a12' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0a0e0c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#4a5350' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1f2823' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#000000' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#101612' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000814' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1a3a2a' }] },
];

export function GoogleMap({
  points,
  center,
  height = 340,
  closed = false,
  mapType = 'standard',
  display = 'line',
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const userLocation = useLocation((s) => s.coords);

  const initial: P = center || points[0] || userLocation || { latitude: 9.082, longitude: 8.6753 };

  const region: Region = {
    latitude: initial.latitude,
    longitude: initial.longitude,
    latitudeDelta: 0.002,
    longitudeDelta: 0.002,
  };

  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;
    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [points.length]);

  const start = points[0];
  const current = points[points.length - 1];
  const useDarkStyle = mapType === 'standard';

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        mapType={mapType}
        customMapStyle={useDarkStyle ? DARK_STYLE : undefined}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled
        loadingBackgroundColor="#0a0e0c"
        loadingIndicatorColor="#00ff88"
      >
        {display === 'line' && points.length > 1 && (
          <Polyline
            coordinates={points}
            strokeColor="#00ff88"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        )}

        {display === 'line' && closed && points.length > 2 && (
          <Polyline
            coordinates={[current, start]}
            strokeColor="#00ff88"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {display === 'line' && !closed && points.length > 3 && (
          <Polyline
            coordinates={[current, start]}
            strokeColor="#00ff88"
            strokeWidth={2}
            lineDashPattern={[10, 10]}
          />
        )}

        {display === 'points' && points.map((pt, idx) => (
          <Marker
            key={String(idx)}
            coordinate={pt}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.dot} />
          </Marker>
        ))}

        {start && (
          <Marker
            coordinate={start}
            title="START"
            pinColor="#00ff88"
            anchor={{ x: 0.5, y: 0.5 }}
          />
        )}

        {current && points.length > 1 && (
          <Marker
            coordinate={current}
            title="You"
            pinColor="#ffffff"
            anchor={{ x: 0.5, y: 0.5 }}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 20,
  },
  map: { width: '100%', height: '100%' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00ff88',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
});
