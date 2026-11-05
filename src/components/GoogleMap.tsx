
import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  MapView,
  Camera,
  ShapeSource,
  FillLayer,
  LineLayer,
  CircleLayer,
  MarkerView,
} from '@maplibre/maplibre-react-native';
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

const TILE_URLS = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  standard:  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  terrain:   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
};

const mapStyle: any = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [TILE_URLS.satellite],
      tileSize: 256,
    },
    'osm-standard': {
      type: 'raster',
      tiles: [TILE_URLS.standard],
      tileSize: 256,
    },
    'esri-terrain': {
      type: 'raster',
      tiles: [TILE_URLS.terrain],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      layout: { visibility: 'none' }, // hidden by default, toggled by prop
    },
    {
      id: 'osm-standard-layer',
      type: 'raster',
      source: 'osm-standard',
      layout: { visibility: 'none' },
    },
    {
      id: 'esri-terrain-layer',
      type: 'raster',
      source: 'esri-terrain',
      layout: { visibility: 'none' },
    },
  ],
};

export function GoogleMap({
  points,
  center,
  height = 340,
  closed = false,
  mapType = 'satellite',
  display = 'line',
}: Props) {
  const cameraRef = useRef<any>(null);
  const userLocation = useLocation((s) => s.coords);

  // Center on points when they change
  useEffect(() => {
    if (!cameraRef.current) return;
    if (points.length === 0) return;

    const coords = points.map(p => [p.longitude, p.latitude]);
    if (points.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: coords[0],
        zoomLevel: 17,
        animationDuration: 500,
      });
    } else {
      cameraRef.current.fitBounds(
        [Math.min(...points.map(p => p.longitude)), Math.max(...points.map(p => p.longitude)), Math.max(...points.map(p => p.latitude)), Math.min(...points.map(p => p.latitude))],
        { padding: { top: 60, right: 60, bottom: 60, left: 60 }, animationDuration: 500 }
      );
    }
  }, [points.length]);

  // Center on user first time
  useEffect(() => {
    if (!cameraRef.current || !userLocation || points.length > 0) return;
    cameraRef.current.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: 17,
      animationDuration: 500,
    });
  }, [userLocation?.latitude, userLocation?.longitude]);

  const initialCenter: [number, number] = center
    ? [center.longitude, center.latitude]
    : points[0]
      ? [points[0].longitude, points[0].latitude]
      : userLocation
        ? [userLocation.longitude, userLocation.latitude]
        : [8.6753, 9.082];

  const lineCoords = points.map(p => [p.longitude, p.latitude]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={styles.map}
        mapStyle={mapStyle}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: 17,
          }}
        />

        {/* Toggle tile layers based on mapType */}
        <FillLayer
          id="satellite-fill"
          source="esri-satellite"
          style={{ visibility: mapType === 'satellite' ? 'visible' : 'none' }}
        />
        <FillLayer
          id="standard-fill"
          source="osm-standard"
          style={{ visibility: mapType === 'standard' ? 'visible' : 'none' }}
        />
        <FillLayer
          id="terrain-fill"
          source="esri-terrain"
          style={{ visibility: mapType === 'terrain' ? 'visible' : 'none' }}
        />

        {/* Boundary line */}
        {display === 'line' && points.length > 1 && (
          <ShapeSource
            id="boundary-line"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: lineCoords,
              },
              properties: {},
            }}
          >
            <LineLayer
              id="line-layer"
              style={{
                lineColor: '#00ff88',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Closed loop line (last to first) */}
        {display === 'line' && closed && points.length > 2 && (
          <ShapeSource
            id="closed-line"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [lineCoords[lineCoords.length - 1], lineCoords[0]],
              },
              properties: {},
            }}
          >
            <LineLayer
              id="closed-line-layer"
              style={{
                lineColor: '#00ff88',
                lineWidth: 4,
                lineDasharray: [8, 8],
              }}
            />
          </ShapeSource>
        )}

        {/* Corner pins */}
        {points.map((p, idx) => (
          <MarkerView
            key={`pin-${idx}`}
            coordinate={[p.longitude, p.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={
                idx === 0
                  ? styles.startPin
                  : styles.cornerPin
              }
            />
          </MarkerView>
        ))}

        {/* User location pin */}
        {userLocation && (
          <MarkerView
            coordinate={[userLocation.longitude, userLocation.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userPin} />
          </MarkerView>
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
    backgroundColor: '#0a0e0c',
  },
  map: { flex: 1 },
  startPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,255,136,0.35)',
    borderWidth: 2,
    borderColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  cornerPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00ff88',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#00ff88',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  userPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
