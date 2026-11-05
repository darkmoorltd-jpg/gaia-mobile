import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { naira } from '../src/utils/marketplace'; // using existing util if available, or fallback

export default function FarmsList() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [farms, setFarms] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  // Load farms every time the screen comes into focus
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFarms(data || []);
    } catch (e: any) {
      Alert.alert('Error', 'Could not load farms: ' + e.message);
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRef(true);
    load();
  };

  const deleteFarm = (id: string, name: string) => {
    Alert.alert('Delete Farm?', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('farms').delete().eq('id', id);
        load();
      }},
    ]);
  };

  // Calculate hectares from boundary points array
  const getHectares = (boundary: any[]) => {
    if (!boundary || boundary.length < 3) return 0;
    // Simple Shoelace formula for area
    let area = 0;
    const R = 6378137; // Earth radius in meters
    for (let i = 0; i < boundary.length; i++) {
      const p1 = boundary[i];
      const p2 = boundary[(i + 1) % boundary.length];
      area += (p2.longitude - p1.longitude) * (2 + Math.sin(p1.latitude * Math.PI / 180) + Math.sin(p2.latitude * Math.PI / 180));
    }
    area = Math.abs(area * R * R / 2);
    return area / 10000; // Convert sq meters to hectares
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={onRefresh} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>YOUR LAND</Text>
            <Text style={styles.title}>My Farms</Text>
          </View>
          <Pressable onPress={() => router.push('/farm-mapping' as any)} style={styles.addBtn}>
            <Text style={styles.addBtnTxt}>+ ADD FARM</Text>
          </Pressable>
        </View>

        {busy && farms.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.neon} />
            <Text style={styles.dim}>Loading your farms…</Text>
          </View>
        ) : farms.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🗺️</Text>
            <Text style={styles.emptyTitle}>No farms mapped yet</Text>
            <Text style={styles.emptySub}>
              Map your farm boundary to unlock satellite monitoring, NDVI crop health, and BOA loan verification.
            </Text>
            <Pressable onPress={() => router.push('/farm-mapping' as any)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnTxt}>MAP YOUR FIRST FARM</Text>
            </Pressable>
          </View>
        ) : (
          farms.map((farm) => {
            const ha = getHectares(farm.boundary || []);
            return (
              <Pressable
                key={farm.id}
                onPress={() => router.push({ pathname: '/satellite', params: { farmId: farm.id } } as any)}
                style={styles.card}
              >
                <View style={styles.cardIcon}>
                  <Text style={{ fontSize: 24 }}>🌾</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{farm.name || 'Unnamed Farm'}</Text>
                  <Text style={styles.cardSub}>
                    {farm.crop || 'Mixed Crops'} · {ha.toFixed(2)} ha
                  </Text>
                  <Text style={styles.cardLoc}>
                    📍 {farm.community ? farm.community + ', ' : ''}{farm.lga ? farm.lga + ', ' : ''}{farm.state || 'Unknown Location'}
                  </Text>
                </View>
                <Pressable onPress={() => deleteFarm(farm.id, farm.name)} style={styles.delBtn}>
                  <Text style={styles.delBtnTxt}>×</Text>
                </Pressable>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: p.neon },
  addBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  dim: { color: p.textMuted, fontSize: 13 },
  
  empty: { alignItems: 'center', padding: 30, marginTop: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 10 },
  emptySub: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: p.neon },
  emptyBtnTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 16, borderRadius: 16, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border, marginBottom: 10,
  },
  cardIcon: {
    width: 50, height: 50, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: p.text },
  cardSub: { fontSize: 12, color: p.neon, fontWeight: '600', marginTop: 2 },
  cardLoc: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  delBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,59,92,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  delBtnTxt: { fontSize: 18, color: '#ff3b5c', fontWeight: '900', lineHeight: 20 },
});
