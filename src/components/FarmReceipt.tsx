import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Svg, { Polygon, Circle, Text as SvgText } from 'react-native-svg';

export default function FarmReceipt({
  farmName, crop, state, lga, community, ward,
  points, areaAcres, perimeterM, centroidLat, centroidLng,
  dateStr, surveyorName, mapSnapshotUri
}: any) {
  
  // ============================================================
  // Calculate SVG ViewBox from raw GPS points
  // ============================================================
  const getPolygonPoints = () => {
    if (!points || points.length < 3) return { polyPoints: '', minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    
    const lats = points.map((p: any) => p.latitude);
    const lngs = points.map((p: any) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Pad the bounding box slightly so the polygon isn't touching the edges
    const latDiff = (maxLat - minLat) || 0.0001;
    const lngDiff = (maxLng - minLng) || 0.0001;
    const padLat = latDiff * 0.2;
    const padLng = lngDiff * 0.2;

    const viewBoxLat = minLat - padLat;
    const viewBoxLng = minLng - padLng;
    const scaleLat = (maxLat + padLat) - viewBoxLat;
    const scaleLng = (maxLng + padLng) - viewBoxLng;

    // Map to 0-200 (width), 0-140 (height)
    const mapped = points.map((p: any) => {
      const x = ((p.longitude - viewBoxLng) / scaleLng) * 200;
      const y = ((maxLat + padLat - p.latitude) / scaleLat) * 140; // Invert Y so North is up
      return { x, y };
    });

    return {
      polyPoints: mapped.map((p: any) => `${p.x},${p.y}`).join(' '),
      mappedPoints: mapped,
    };
  };

  const { polyPoints, mappedPoints } = getPolygonPoints();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>GAIA LAND SURVEY</Text>
        <Text style={styles.subtitle}>Official Farm Boundary Record</Text>
      </View>

      <View style={styles.divider} />

      {/* Farm Details */}
      <View style={styles.row}><Text style={styles.label}>FARM NAME</Text><Text style={styles.value}>{farmName || '—'}</Text></View>
      <View style={styles.row}><Text style={styles.label}>CROP</Text><Text style={styles.value}>{crop || 'Mixed'}</Text></View>
      <View style={styles.row}><Text style={styles.label}>SURVEYOR</Text><Text style={styles.value}>{surveyorName || 'Agent'}</Text></View>
      <View style={styles.row}><Text style={styles.label}>DATE</Text><Text style={styles.value}>{dateStr}</Text></View>

      <View style={styles.divider} />

      {/* Location */}
      <View style={styles.row}><Text style={styles.label}>STATE</Text><Text style={styles.value}>{state || '—'}</Text></View>
      <View style={styles.row}><Text style={styles.label}>LGA</Text><Text style={styles.value}>{lga || '—'}</Text></View>
      <View style={styles.row}><Text style={styles.label}>COMMUNITY</Text><Text style={styles.value}>{community || '—'}</Text></View>
      <View style={styles.row}><Text style={styles.label}>WARD</Text><Text style={styles.value}>{ward || '—'}</Text></View>

      <View style={styles.divider} />

      {/* Dual Maps: Satellite + Vector Survey Plan */}
      <View style={styles.mapSection}>
        <View style={styles.mapBox}>
          <Text style={styles.mapLabel}>SATELLITE</Text>
          {mapSnapshotUri ? (
            <Image source={{ uri: mapSnapshotUri }} style={styles.mapImage} />
          ) : (
            <View style={[styles.mapImage, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 10, color: '#aaa' }}>No Satellite Snapshot</Text>
            </View>
          )}
        </View>
        
        <View style={styles.mapBox}>
          <Text style={styles.mapLabel}>SURVEY PLAN</Text>
          <View style={styles.surveyPlanContainer}>
            {points && points.length >= 3 ? (
              <Svg width="100%" height="100%" viewBox="0 0 200 140">
                <Polygon points={polyPoints} fill="rgba(0,200,83,0.15)" stroke="#00c853" strokeWidth="2" />
                {mappedPoints.map((p: any, i: number) => (
                  <React.Fragment key={i}>
                    <Circle cx={p.x} cy={p.y} r={i === 0 ? "4" : "3"} fill={i === 0 ? "#ffb300" : "#333"} />
                    <SvgText x={p.x + 4} y={p.y - 4} fontSize="10" fontFamily="monospace" fill="#333">
                      {String.fromCharCode(65 + i)}
                    </SvgText>
                  </React.Fragment>
                ))}
                {/* North Arrow */}
                <SvgText x="185" y="20" fontSize="16" fill="#ff3b5c">↑</SvgText>
                <SvgText x="182" y="32" fontSize="9" fill="#333">N</SvgText>
              </Svg>
            ) : (
              <Text style={{ fontSize: 10, color: '#aaa' }}>Not enough points</Text>
            )}
          </View>
        </View>
      </View>

      {/* Geospatial Data */}
      <View style={styles.grid}>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>AREA</Text><Text style={styles.gridValue}>{Number(areaAcres).toFixed(2)} ac</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>PERIMETER</Text><Text style={styles.gridValue}>{Number(perimeterM).toFixed(0)} m</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>VERTICES</Text><Text style={styles.gridValue}>{points?.length || 0} pins</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>LATITUDE</Text><Text style={styles.gridValue}>{Number(centroidLat).toFixed(5)}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>LONGITUDE</Text><Text style={styles.gridValue}>{Number(centroidLng).toFixed(5)}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>CERT ID</Text><Text style={styles.gridValue}>GAIA-{Date.now().toString(36).toUpperCase().slice(-6)}</Text></View>
      </View>

      <View style={styles.divider} />

      {/* Footer */}
      <Text style={styles.footer}>This digital survey was generated by GAIA Mobile. Valid for NDFR, BOA, and bank verification.</Text>
      <Text style={styles.footerBrand}>Powered by DARKMOOR LTD 🌱</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, width: 360, alignSelf: 'center', borderWidth: 2, borderColor: '#00c853' },
  header: { alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#00c853', letterSpacing: 2 },
  subtitle: { fontSize: 10, color: '#666', marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '800', color: '#888', width: 100 },
  value: { fontSize: 13, fontWeight: '700', color: '#111', textAlign: 'right', flex: 1 },
  
  mapSection: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mapBox: { flex: 1 },
  mapLabel: { fontSize: 9, fontWeight: '800', color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  mapImage: { width: '100%', height: 120, borderRadius: 8, backgroundColor: '#ddd' },
  surveyPlanContainer: { width: '100%', height: 120, borderRadius: 8, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#ccc', overflow: 'hidden' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridItem: { width: '31%', backgroundColor: '#f5f5f5', padding: 8, borderRadius: 6 },
  gridLabel: { fontSize: 8, fontWeight: '800', color: '#888', marginBottom: 2 },
  gridValue: { fontSize: 11, fontWeight: '900', color: '#111' },
  footer: { fontSize: 9, color: '#888', textAlign: 'center', lineHeight: 14, marginTop: 8 },
  footerBrand: { fontSize: 10, color: '#00c853', textAlign: 'center', fontWeight: '900', marginTop: 8, letterSpacing: 1 },
});
