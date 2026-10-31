import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Linking, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const { width, height } = Dimensions.get('window');

export default function StoreMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { store_id } = useLocalSearchParams<{ store_id: string }>();

  const [busy, setBusy] = useState(true);
  const [buyerLoc, setBuyerLoc] = useState<any>(null);
  const [sellerLoc, setSellerLoc] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      try {
        // 1. Get Buyer Location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setBuyerLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }

        // 2. Get Seller Location from DB
        const { data: store } = await supabase.from('marketplace_stores').select('*').eq('id', store_id).single();
        if (store && store.latitude && store.longitude) {
          setStoreInfo(store);
          setSellerLoc({ latitude: Number(store.latitude), longitude: Number(store.longitude) });
        } else {
          Alert.alert('No Map Data', 'This seller has not pinned their farm on the map yet.');
          router.back();
        }
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setBusy(false);
      }
    })();
  }, [store_id]);

  useEffect(() => {
    // Zoom map to fit both markers
    if (buyerLoc && sellerLoc && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([buyerLoc, sellerLoc], {
          edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
          animated: true,
        });
      }, 500);
    }
  }, [buyerLoc, sellerLoc]);

  const openGoogleMaps = () => {
    if (!sellerLoc) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${sellerLoc.latitude},${sellerLoc.longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  if (busy) return <View style={styles.center}><ActivityIndicator size="large" color={palette.neon} /></View>;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: sellerLoc?.latitude || 9.0765,
          longitude: sellerLoc?.longitude || 7.3986,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {sellerLoc ? (
          <Marker coordinate={sellerLoc} title={storeInfo?.store_name} description="Farm / Store Location" pinColor={palette.neon} />
        ) : null}

        {buyerLoc && sellerLoc ? (
          <Polyline
            coordinates={[buyerLoc, sellerLoc]}
            strokeColor={palette.neon}
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />
        ) : null}
      </MapView>

      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{storeInfo?.store_name}</Text>
          <Text style={styles.sub}>📍 {storeInfo?.location}</Text>
        </View>
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        <Text style={styles.cardTitle}>Ready to visit the farm?</Text>
        <Text style={styles.cardSub}>Get live traffic updates and turn-by-turn directions via Google Maps.</Text>
        
        <Pressable onPress={openGoogleMaps} style={styles.ctaBtn}>
          <Text style={styles.ctaTxt}>🚀 START NAVIGATION</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: p.obsidian },
  map: { width: '100%', height: '100%' },
  header: {
    position: 'absolute', top: 50, left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: p.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backTxt: { fontSize: 28, color: p.neon, lineHeight: 30 },
  title: { fontSize: 16, fontWeight: '900', color: '#fff' },
  sub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  bottomCard: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: '#111', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: p.neon,
    shadowColor: p.neon, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  cardSub: { fontSize: 13, color: '#888', marginTop: 6, marginBottom: 20, lineHeight: 18 },
  ctaBtn: { backgroundColor: p.neon, paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
});
