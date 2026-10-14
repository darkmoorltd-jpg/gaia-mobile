import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function VideoHistoryMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('scan_sessions')
        .select('id,crop,consensus_label,gps_lat,gps_lon,created_at,severity_pct')
        .not('gps_lat', 'is', null)
        .not('gps_lon', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      setRows(data || []);
      setBusy(false);
    })();
  }, []);

  const html = () => {
    const markers = rows.map((r) => {
      const isHealthy = (r.consensus_label || '').toLowerCase().includes('healthy');
      const color = isHealthy ? '#00c853' : (r.severity_pct > 40 ? '#ff3b5c' : '#ffb300');
      return `
        L.circleMarker([${r.gps_lat}, ${r.gps_lon}], {
          radius: 8, color: '${color}', fillColor: '${color}', fillOpacity: 0.85, weight: 2
        }).addTo(map).bindPopup('<b>${(r.crop || '').replace('_', ' ')}</b><br>${r.consensus_label || ''}<br>${new Date(r.created_at).toLocaleString()}');
      `;
    }).join('\n');
    const center = rows[0] ? `[${rows[0].gps_lat}, ${rows[0].gps_lon}]` : '[9.0765, 7.3986]';
    return `<!DOCTYPE html><html><head>
      <meta name="viewport" content="initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <style>html,body,#map{margin:0;padding:0;height:100%;background:#0a0a0a}</style>
      </head><body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        var map = L.map('map').setView(${center}, 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        ${markers}
      </script>
      </body></html>`;
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.header}>
        <Text style={styles.back}>BACK</Text>
        <Text style={styles.title}>Scan Map</Text>
        <Text style={styles.sub}>{rows.length} geotagged sessions</Text>
      </Pressable>
      {busy ? (
        <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} />
      ) : rows.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.empty}>No geotagged scans yet.</Text>
          <Text style={styles.emptySub}>Enable location when scanning to build your field map.</Text>
        </ScrollView>
      ) : (
        <WebView originWhitelist={['*']} source={{ html: html() }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled />
      )}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  empty: { fontSize: 16, color: p.text, fontWeight: '800', textAlign: 'center', marginTop: 40 },
  emptySub: { fontSize: 12, color: p.textMuted, textAlign: 'center', marginTop: 8 },
});
