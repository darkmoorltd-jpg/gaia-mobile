import React, { useRef, useMemo, useEffect, Component, ReactNode } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  CircleLayer,
  RasterSource,
  RasterLayer,
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

class MapErrorBoundary extends Component<
  { children: ReactNode; height: number },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };
  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: String((error && error.message) || error || 'Unknown') };
  }
  componentDidCatch(error: any, info: any) {
    console.warn('MapErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.errorWrap, { height: this.props.height }]}>
          <Text style={styles.errorTitle}>Map unavailable</Text>
          <Text style={styles.errorMsg} numberOfLines={3}>{this.state.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const TILE_DARK = 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const TILE_SAT  = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TILE_TERR = 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png';

function pickTile(mode: ViewMode): string {
  if (mode === 'satellite' || mode === 'hybrid') return TILE_SAT;
  if (mode === 'terrain') return TILE_TERR;
  return TILE_DARK;
}

function InnerMap({
  points,
  center,
  height = 340,
  closed = false,
  mapType = 'standard',
  display = 'line',
}: Props) {
  const mapRef = useRef<any>(null);
  const userLocation = useLocation((s) => s.coords);

  const initialCenter = useMemo<[number, number]>(() => {
    if (points.length > 0) return [points[0].longitude, points[0].latitude];
    if (center) return [center.longitude, center.latitude];
    if (userLocation) return [userLocation.longitude, userLocation.latitude];
    return [8.6753, 9.082];
  }, [
    points.length,
    center ? center.latitude : null,
    center ? center.longitude : null,
    userLocation ? userLocation.latitude : null,
    userLocation ? userLocation.longitude : null,
  ]);

  const lineGeoJSON = useMemo(() => {
    if (points.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: points.map((p) => [p.longitude, p.latitude]),
      },
    };
  }, [points]);

  const pointCollection = useMemo(() => {
    if (points.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: points.map((p, i) => ({
        type: 'Feature' as const,
        properties: { idx: i },
        geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
      })),
    };
  }, [points]);

  const userPoint = useMemo(() => {
    if (!userLocation) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Point' as const,
        coordinates: [userLocation.longitude, userLocation.latitude],
      },
    };
  }, [
    userLocation ? userLocation.latitude : null,
    userLocation ? userLocation.longitude : null,
  ]);

  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;
    try {
      const lngs = points.map((p) => p.longitude);
      const lats = points.map((p) => p.latitude);
      const minLng = Math.min.apply(null, lngs);
      const maxLng = Math.max.apply(null, lngs);
      const minLat = Math.min.apply(null, lats);
      const maxLat = Math.max.apply(null, lats);
      if (typeof mapRef.current.fitBounds === 'function') {
        mapRef.current.fitBounds(
          [maxLng, maxLat],
          [minLng, minLat],
          [80, 80, 80, 80],
          400,
        );
      }
    } catch (e) {
      console.warn('fitBounds failed:', e);
    }
  }, [points.length]);

  const tile = pickTile(mapType);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: 16,
          }}
        />

        <RasterSource id="base" tileUrlTemplates={[tile]} tileSize={256}>
          <RasterLayer id="base-layer" style={{ rasterOpacity: 0.95 }} />
        </RasterSource>

        {display === 'line' && lineGeoJSON ? (
          <ShapeSource id="trail" shape={lineGeoJSON as any}>
            <LineLayer
              id="trail-layer"
              style={{
                lineColor: '#00ff88',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        ) : null}

        {display === 'points' && pointCollection ? (
          <ShapeSource id="pts" shape={pointCollection as any}>
            <CircleLayer
              id="pts-layer"
              style={{
                circleColor: '#00ff88',
                circleRadius: 6,
                circleStrokeColor: '#ffffff',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        ) : null}

        {userPoint ? (
          <ShapeSource id="user" shape={userPoint as any}>
            <CircleLayer
              id="user-layer"
              style={{
                circleColor: '#00ff88',
                circleRadius: 8,
                circleOpacity: 0.9,
                circleStrokeColor: '#00ff88',
                circleStrokeWidth: 4,
                circleStrokeOpacity: 0.3,
              }}
            />
          </ShapeSource>
        ) : null}
      </MapView>

      <Pressable
        onPress={() => {
          try {
            if (!mapRef.current || !userLocation) return;
            mapRef.current.setCamera({
              centerCoordinate: [userLocation.longitude, userLocation.latitude],
              zoomLevel: 17,
              animationDuration: 500,
            });
          } catch (e) {
            console.warn('recenter failed:', e);
          }
        }}
        style={styles.recenterBtn}
      >
        <Text style={styles.recenterIcon}>{'◎'}</Text>
      </Pressable>
    </View>
  );
}

export function MapLibreMap(props: Props) {
  return (
    <MapErrorBoundary height={props.height || 340}>
      <InnerMap {...props} />
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#0a0e0c',
  },
  map: { width: '100%', height: '100%' },
  recenterBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0a0e0c',
    borderWidth: 1,
    borderColor: '#00ff88',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  recenterIcon: { fontSize: 22, color: '#00ff88', fontWeight: '900', lineHeight: 24 },
  errorWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0e0c',
    borderRadius: 20,
    padding: 20,
  },
  errorTitle: { color: '#ff3b5c', fontWeight: '800', fontSize: 14, marginBottom: 6 },
  errorMsg: { color: '#8899a6', fontSize: 11, textAlign: 'center' },
});
