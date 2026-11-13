import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Point {
  latitude: number;
  longitude: number;
}

interface Props {
  points: Point[];
  currentLocation: Point | null;
  height?: number;
  closed?: boolean;
}

export default function FreeMap({ points, currentLocation, height = 400, closed = false }: Props) {
  const webViewRef = useRef<WebView>(null);
  const mapInitialized = useRef(false);

  // 1. Send the new points to the WebView whenever they change
  useEffect(() => {
    if (!webViewRef.current || !mapInitialized.current) return;

    const payload = {
      points: points.map(p => [p.latitude, p.longitude]),
      current: currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null,
      closed: closed
    };

    const script = `
      if (window.updateMap) {
        window.updateMap(${JSON.stringify(payload)});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  }, [points, currentLocation, closed]);

  // 2. The HTML Template using Leaflet + Esri Satellite
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        #map { width: 100vw; height: 100vh; }
        .pin-icon {
          background-color: #00ff88;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0,255,136,0.8);
        }
        .current-icon {
          background-color: #2196f3;
          border: 2px solid #ffffff;
          border-radius: 50%;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // 100% Free Esri Satellite Imagery (No API Key)
        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Esri'
        });

        const map = L.map('map', { zoomControl: false }).setView([9.0765, 7.3986], 16); // Default: Abuja
        satellite.addTo(map);

        let polygon = null;
        let currentMarker = null;
        const markers = [];
        let firstView = true;

        window.updateMap = function(data) {
          // Clear old markers
          markers.forEach(m => map.removeLayer(m));
          markers.length = 0;
          if (polygon) map.removeLayer(polygon);

          const latlngs = data.points.map(p => L.latLng(p[0], p[1]));

          // Add vertex pins
          latlngs.forEach((latlng, i) => {
            const isFirst = i === 0;
            const marker = L.circleMarker(latlng, {
              radius: isFirst ? 8 : 6,
              color: '#fff',
              weight: 2,
              fillColor: isFirst ? '#ffb300' : '#00ff88',
              fillOpacity: 1
            }).addTo(map);
            markers.push(marker);
          });

          // Draw polygon or polyline
          if (latlngs.length >= 2) {
            polygon = L.polygon(latlngs, {
              color: '#00ff88',
              weight: 3,
              fillOpacity: data.closed ? 0.3 : 0.1,
              dashArray: data.closed ? '' : '5, 5'
            }).addTo(map);
          }

          // Update current location marker
          if (data.current) {
            const curLatLng = L.latLng(data.current[0], data.current[1]);
            if (currentMarker) {
              currentMarker.setLatLng(curLatLng);
            } else {
              currentMarker = L.circleMarker(curLatLng, {
                radius: 7,
                color: '#fff',
                weight: 2,
                fillColor: '#2196f3',
                fillOpacity: 1
              }).addTo(map);
            }
            
            // Auto-center if it's the first view
            if (firstView) {
              map.setView(curLatLng, 17);
              firstView = false;
            }
          }

          // Fit bounds if we have points
          if (latlngs.length > 1) {
            const bounds = L.latLngBounds(latlngs);
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        };

        // Notify RN that map is ready
        window.onload = function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        };
      </script>
    </body>
    </html>
  `;

  return (
    <View style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'ready') {
              mapInitialized.current = true;
              // Initial push
              const payload = {
                points: points.map(p => [p.latitude, p.longitude]),
                current: currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null,
                closed: closed
              };
              webViewRef.current?.injectJavaScript(`
                if (window.updateMap) {
                  window.updateMap(${JSON.stringify(payload)});
                }
                true;
              `);
            }
          } catch (e) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
});
