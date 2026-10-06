import React, { useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  FillLayer,
  MarkerView,
  RasterSource,
  RasterLayer,
  type MapViewRef,
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

// Free raster tile sources — no API key needed
const TILES = {
  dark:      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  labels:    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  terrain:   'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
};

export function MapLibreMap({
  points,
  center,
  height = 340,
  closed = false,
  mapType = 'standard',
  display = 'line',
}: Props) {
  const mapRef = useRef<MapViewRef | null>(null);
  const userLocation = useLocation((s) => s.coords);

  // ---- Bounds from drawn points ----
  const bounds = useMemo(() => {
    if (points.length < 2) return null;
    let minLat = points[0].latitude, maxLat = points[0].latitude;
    let minLng = points[0].longitude, maxLng = points[0].longitude;
    for (const p of points) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return { ne: [maxLng, maxLat] as [number, number], sw: [minLng, minLat] as [number, number] };
  }, [points.length]);

  // ---- Camera config ----
  const cameraProps = useMemo(() => {
    if (bounds) {
      return {
        bounds: {
          ne: bounds.ne,
          sw: bounds.sw,
          paddingLeft: 60,
          paddingRight: 60,
          paddingTop: 60,
          paddingBottom: 60,
        },
      } as any;
    }
    if (center) return { centerCoordinate: [center.longitude, center.latitude] as [number, number], zoomLevel: 16 };
    if (userLocation) return { centerCoordinate: [userLocation.longitude, userLocation.latitude] as [number, number], zoomLevel: 16 };
    return { centerCoordinate: [8.6753, 9.082] as [number, number], zoomLevel: 6 };
  }, [bounds?.ne[0], bounds?.ne[1], bounds?.sw[0], bounds?.sw[1], center?.latitude, center?.longitude, userLocation?.latitude, userLocation?.longitude]);

  // ---- Line + polygon GeoJSON ----
  const lineGeoJSON = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
  }), [points]);

  const closedLineGeoJSON = useMemo(() => {
    if (!closed || points.length < 3) return null;
    const first = points[0];
    const last = points[points.length - 1];
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [last.longitude, last.latitude],
          [first.longitude, first.latitude],
        ],
      },
    };
  }, [closed, points]);

  const polygonGeoJSON = useMemo(() => {
    if (points.length < 3) return null;
    const coords = points.map((p) => [p.longitude, p.latitude]);
    coords.push([points[0].longitude, points[0].latitude]);
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [coords] },
    };
  }, [points]);

  const start = points[0];
  const current = points[points.length - 1];

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView ref={mapRef} style={styles.map} logoEnabled={false} attributionEnabled={false}>
        <Camera {...cameraProps} animationDuration={400} />

        {/* ---------- BASE RASTER LAYERS ---------- */}
        {mapType === 'standard' && (
          <RasterSource id="src-dark" tileUrlTemplates={[TILES.dark]} tileSize={256}>
            <RasterLayer id="layer-dark" style={{ rasterOpacity: 0.95 }} />
          </RasterSource>
        )}

        {(mapType === 'satellite' || mapType === 'hybrid') && (
          <RasterSource id="src-sat" tileUrlTemplates={[TILES.satellite]} tileSize={256}>
            <RasterLayer id="layer-sat" style={{ rasterOpacity: 1 }} />
          </RasterSource>
        )}

        {mapType === 'hybrid' && (
          <RasterSource id="src-labels" tileUrlTemplates={[TILES.labels]} tileSize={256}>
            <RasterLayer id="layer-labels" style={{ rasterOpacity: 0.9 }} />
          </RasterSource>
        )}

        {mapType === 'terrain' && (
          <RasterSource id="src-terrain" tileUrlTemplates={[TILES.terrain]} tileSize={256}>
            <RasterLayer id="layer-terrain" style={{ rasterOpacity: 1 }} />
          </RasterSource>
        )}

        {/* ---------- FILLED POLYGON (when loop closed) ---------- */}
        {closed && polygonGeoJSON ? (
          <ShapeSource id="src-fill" shape={polygonGeoJSON as any}>
            <FillLayer id="layer-fill" style={{ fillColor: '#00ff88', fillOpacity: 0.15 }} />
          </ShapeSource>
        ) : null}

        {/* ---------- THE TRAIL ---------- */}
        {display === 'line' && points.length > 1 ? (
          <ShapeSource id="src-line" shape={lineGeoJSON as any}>
            <LineLayer
              id="layer-line"
              style={{
                lineColor: '#00ff88',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        ) : null}

        {display === 'line' && closedLineGeoJSON ? (
          <ShapeSource id="src-closing" shape={closedLineGeoJSON as any}>
            <LineLayer id="layer-closing" style={{ lineColor: '#00ff88', lineWidth: 5 }} />
          </ShapeSource>
        ) : null}

        {/* ---------- USER MARKER ---------- */}
        {userLocation ? (
          <MarkerView
            coordinate={[userLocation.longitude, userLocation.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <View style={styles.userRing}>
              <View style={styles.userDot} />
            </View>
          </MarkerView>
        ) : null}

        {/* ---------- POINTS MODE MARKERS ---------- */}
        {display === 'points'
          ? points.map((pt, idx) => (
              <MarkerView
                key={'pt-' + idx}
                coordinate={[pt.longitude, pt.latitude]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <View style={styles.pointDot} />
              </MarkerView>
            ))
          : null}

        {/* ---------- START MARKER ---------- */}
        {start ? (
          <MarkerView coordinate={[start.longitude, start.latitude]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View style={styles.startPin} />
          </MarkerView>
        ) : null}

        {/* ---------- CURRENT MARKER ---------- */}
        {current && points.length > 1 && display === 'line' ? (
          <MarkerView coordinate={[current.longitude, current.latitude]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View style={styles.currentPin} />
          </MarkerView>
        ) : null}
      </MapView>

      {/* ---------- RECENTER ---------- */}
      <Pressable
        onPress={() => {
          if (!mapRef.current) return;
          if (userLocation) {
            mapRef.current.setCamera({
              centerCoordinate: [userLocation.longitude, userLocation.latitude],
              zoomLevel: 17,
              animationDuration: 500,
            });
          }
        }}
        style={styles.recenterBtn}
      >
        <Text style={styles.recenterIcon}>◎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', borderRadius: 20 },
  map: { width: '100%', height: '100%' },
  userRing: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,255,136,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#00ff88',
  },
  userDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00ff88' },
  pointDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#00ff88',
    borderWidth: 1, borderColor: '#ffffff',
  },
  startPin: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#00ff88',
    borderWidth: 3, borderColor: '#0a0e0c',
  },
  currentPin: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 3, borderColor: '#00ff88',
  },
  recenterBtn: {
    position: 'absolute', right: 12, bottom: 12,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0a0e0c',
    borderWidth: 1, borderColor: '#00ff88',
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
  },
  recenterIcon: { fontSize: 22, color: '#00ff88', fontWeight: '900', lineHeight: 24 },
});
