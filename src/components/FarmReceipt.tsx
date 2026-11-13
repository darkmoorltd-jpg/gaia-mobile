import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import ViewShot from 'react-native-view-shot';

const FarmReceipt = forwardRef<ViewShot, { farm: any }>(({ farm }, ref) => {
  if (!farm) return null;
  const mapUrl = `https://static-maps.yandex.ru/1.x/?l=sat&pt=${farm.centroid_lng},${farm.centroid_lat},pm2rdm&z=16&size=600,350&lang=en_US`;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <ViewShot ref={ref} options={{ format: 'jpg', quality: 1.0 }} style={styles.container}>
      <View style={styles.receipt}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>GAIA</Text>
            <Text style={styles.subBrand}>Powered by DARKMOOR LTD</Text>
          </View>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <Image source={{ uri: mapUrl }} style={styles.mapImage} resizeMode="cover" />
        <View style={styles.body}>
          <Text style={styles.farmName}>{farm.name}</Text>
          {farm.crop ? <Text style={styles.cropName}>Crop: {farm.crop}</Text> : null}
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>ACRES</Text>
              <Text style={styles.gridValue}>{farm.acres.toFixed(2)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>HECTARES</Text>
              <Text style={styles.gridValue}>{farm.hectares.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>PERIMETER</Text>
              <Text style={styles.gridValue}>{farm.perimeter.toFixed(0)} m</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>SQUARE METERS</Text>
              <Text style={styles.gridValue}>{farm.area_m2.toFixed(0)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>LOCATION DATA</Text>
          <Text style={styles.locationText}>
            {farm.community ? `${farm.community}, ` : ''}{farm.lga}, {farm.state}
            {farm.ward ? `\nWard: ${farm.ward}` : ''}
          </Text>
          <Text style={styles.coords}>GPS: {farm.centroid_lat.toFixed(5)}, {farm.centroid_lng.toFixed(5)}</Text>
          <View style={styles.divider} />
          <View style={styles.footer}>
            <View>
              <Text style={styles.footerLabel}>SURVEYED BY</Text>
              <Text style={styles.footerValue}>{farm.surveyor || 'GAIA Agent'}</Text>
            </View>
            <View>
              <Text style={styles.footerLabel}>ID</Text>
              <Text style={styles.footerValue}>#{farm.id?.slice(0, 6).toUpperCase() || 'PENDING'}</Text>
            </View>
          </View>
        </View>
      </View>
    </ViewShot>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 10 },
  receipt: { backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', width: 340 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0a1a10' },
  brand: { fontSize: 24, fontWeight: '900', color: '#00ff88', letterSpacing: 2 },
  subBrand: { fontSize: 8, color: '#888', fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  date: { fontSize: 12, color: '#fff', fontWeight: '600' },
  mapImage: { width: '100%', height: 180, backgroundColor: '#eee' },
  body: { padding: 16 },
  farmName: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  cropName: { fontSize: 13, color: '#666', fontWeight: '600', marginTop: 2 },
  grid: { flexDirection: 'row', marginTop: 16, gap: 12 },
  gridItem: { flex: 1, backgroundColor: '#f4faf5', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#c8e6c9' },
  gridLabel: { fontSize: 9, color: '#558b2f', fontWeight: '800', letterSpacing: 1 },
  gridValue: { fontSize: 16, color: '#1b5e20', fontWeight: '900', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  sectionTitle: { fontSize: 9, color: '#999', fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  locationText: { fontSize: 14, color: '#333', fontWeight: '700', lineHeight: 20 },
  coords: { fontSize: 12, color: '#666', fontFamily: 'monospace', marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontSize: 8, color: '#999', fontWeight: '800', letterSpacing: 1 },
  footerValue: { fontSize: 12, color: '#000', fontWeight: '700', marginTop: 2 },
});
export default FarmReceipt;
