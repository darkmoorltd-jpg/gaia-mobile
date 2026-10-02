import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Point { latitude: number; longitude: number; }
interface Props {
  points: Point[];
  center?: Point;
  height?: number;
  zoom?: number;
}

export function LeafletMap({ points, center, height = 340, zoom = 17 }: Props) {
  const c = center || (points.length > 0 ? points[0] : { latitude: 9.05785, longitude: 7.49508 });

  const html = useMemo(() => {
    const polylineJson = JSON.stringify(points.map(p => [p.latitude, p.longitude]));
    const startJson = points.length > 0 ? JSON.stringify([points[0].latitude, points[0].longitude]) : 'null';
    const endJson = points.length > 1 ? JSON.stringify([points[points.length-1].latitude, points[points.length-1].longitude]) : 'null';

    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #000; }
  .leaflet-container { background: #1a1a1a; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${c.latitude}, ${c.longitude}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  var pts = ${polylineJson};
  if (pts.length > 0) {
    var poly = L.polyline(pts, { color: '#00ff88', weight: 5, opacity: 1 }).addTo(map);
    map.fitBounds(poly.getBounds(), { padding: [40, 40] });
  }

  var start = ${startJson};
  if (start) {
    L.circleMarker(start, { radius: 8, color: '#00ff88', fillColor: '#00ff88', fillOpacity: 1 }).addTo(map);
  }
  var end = ${endJson};
  if (end) {
    L.circleMarker(end, { radius: 8, color: '#ffb830', fillColor: '#ffb830', fillOpacity: 1 }).addTo(map);
  }

  // Show current location marker
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
        radius: 7, color: '#4285f4', fillColor: '#4285f4', fillOpacity: 0.9
      }).addTo(map);
    });
  }
</script>
</body>
</html>`;
  }, [points, c.latitude, c.longitude, zoom]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#000' },
});
