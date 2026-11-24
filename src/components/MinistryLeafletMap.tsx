import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface LeafletFarmer {
  user_id: string;
  full_name: string;
  state?: string | null;
  lga?: string | null;
  latest_ndvi_health?: string | null;
  gps_lat?: number | null;
  gps_lon?: number | null;
  polygon_centroid_lat?: number | null;
  polygon_centroid_lon?: number | null;
  farm_polygon_geojson?: any;
}

interface Props {
  farmers: LeafletFarmer[];
  showPins?: boolean;
  showPolygons?: boolean;
  onFarmerPress?: (userId: string) => void;
}

const healthColor = (h?: string | null) => {
  if (h === 'healthy') return '#00ff88';
  if (h === 'moderate') return '#ffb300';
  if (h === 'poor' || h === 'critical') return '#ff3b5c';
  return '#8899a6';
};

export default function LeafletMap({ farmers, showPins = true, showPolygons = true, onFarmerPress }: Props) {
  const html = useMemo(() => {
    // Build marker + polygon data arrays to inject
    const pins = farmers
      .map(f => {
        const lat = Number(f.polygon_centroid_lat || f.gps_lat);
        const lon = Number(f.polygon_centroid_lon || f.gps_lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          id: f.user_id,
          lat, lon,
          name: f.full_name || 'Farmer',
          state: f.state || '',
          lga: f.lga || '',
          color: healthColor(f.latest_ndvi_health),
          health: f.latest_ndvi_health || 'no data',
        };
      })
      .filter(Boolean);

    const polygons = farmers
      .map(f => {
        const gj = f.farm_polygon_geojson;
        if (!gj || !Array.isArray(gj.coordinates)) return null;
        const ring = gj.coordinates[0];
        if (!Array.isArray(ring) || ring.length < 3) return null;
        // Leaflet expects [lat, lon] format
        const coords = ring.map(([lng, lat]: any) => [Number(lat), Number(lng)])
                          .filter(([a, b]: any) => Number.isFinite(a) && Number.isFinite(b));
        if (coords.length < 3) return null;
        return {
          id: f.user_id,
          coords,
          color: healthColor(f.latest_ndvi_health),
          name: f.full_name || 'Farmer',
        };
      })
      .filter(Boolean);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>GAIA Ministry Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #060B18; }
    .leaflet-container { background: #0a1122; }
    .leaflet-popup-content-wrapper {
      background: #1a1f2e; color: #fff; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .leaflet-popup-tip { background: #1a1f2e; }
    .leaflet-popup-content { font-family: -apple-system, Helvetica, Arial; font-size: 13px; }
    .popup-name { font-weight: 900; margin-bottom: 4px; font-size: 14px; }
    .popup-meta { color: #8899a6; font-size: 11px; margin: 2px 0; }
    .popup-btn {
      display: block; margin-top: 10px; padding: 8px 12px; background: #00ff88;
      color: #000; text-decoration: none; border-radius: 6px; text-align: center;
      font-weight: 900; font-size: 11px; letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const pins = ${JSON.stringify(pins)};
    const polygons = ${JSON.stringify(polygons)};
    const showPins = ${showPins ? 'true' : 'false'};
    const showPolygons = ${showPolygons ? 'true' : 'false'};

    const map = L.map('map', { zoomControl: true }).setView([9.0765, 8.6753], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const bounds = [];

    // Polygons first (below markers)
    if (showPolygons) {
      polygons.forEach(function(p) {
        const poly = L.polygon(p.coords, {
          color: p.color,
          fillColor: p.color,
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(map);
        poly.bindTooltip(p.name, { sticky: true });
        p.coords.forEach(function(c) { bounds.push(c); });
      });
    }

    // Markers on top
    if (showPins) {
      pins.forEach(function(p) {
        const marker = L.circleMarker([p.lat, p.lon], {
          radius: 8,
          fillColor: p.color,
          color: '#000',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);

        const popup = '<div class="popup-name">' + p.name + '</div>' +
          '<div class="popup-meta">' + p.lga + (p.lga && p.state ? ', ' : '') + p.state + '</div>' +
          '<div class="popup-meta">NDVI: ' + p.health.toUpperCase() + '</div>' +
          '<a href="#" class="popup-btn" onclick="openFarmer(\\'' + p.id + '\\');return false;">VIEW PROFILE</a>';
        marker.bindPopup(popup);

        bounds.push([p.lat, p.lon]);
      });
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    }

    function openFarmer(userId) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'open_farmer',
        userId: userId,
      }));
    }
  </script>
</body>
</html>`;
  }, [farmers, showPins, showPolygons]);

  const onMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'open_farmer' && onFarmerPress) {
        onFarmerPress(msg.userId);
      }
    } catch {}
  };

  return (
    <View style={styles.wrap}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => <View style={styles.web} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#060B18' },
  web: { flex: 1, backgroundColor: '#060B18' },
});
