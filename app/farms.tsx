import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, GlassCard, NeonButton } from '../src/components';
import { listFarms, deleteFarm, Farm } from '../src/utils/farms';
import { palette, typography, spacing } from '../src/theme';

export default function FarmsList() {
  const router = useRouter();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listFarms();
    setFarms(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (f: Farm) => {
    Alert.alert('Delete farm?', 'Remove ' + f.name + ' permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const err = await deleteFarm(f.id!);
        if (err) Alert.alert('Error', err); else load();
      }},
    ]);
  };

  return (
    <Screen glow="crops">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.neon} />}
      >
        <Text style={styles.title}>My Farms</Text>
        <Text style={styles.subtitle}>
          {farms.length === 0 ? 'No farms mapped yet' : farms.length + ' farm' + (farms.length > 1 ? 's' : '') + ' mapped'}
        </Text>

        <NeonButton label="+ MAP NEW FARM" onPress={() => router.push('/farm-mapping')} style={{ marginTop: spacing.lg }} />
        <View style={{ height: spacing.xl }} />

        {farms.map((farm) => (
          <Pressable
            key={farm.id}
            onPress={() => router.push({ pathname: '/farm-detail', params: { id: farm.id } })}
            onLongPress={() => remove(farm)}
            style={{ marginBottom: spacing.md }}
          >
            <GlassCard>
              <View style={styles.row}>
                <View style={styles.iconBox}><Text style={styles.icon}>🌾</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.farmName}>{farm.name}</Text>
                  <Text style={styles.farmSub}>
                    {(farm.crop ? farm.crop + ' · ' : '') + (farm.area_acres ?? 0).toFixed(3) + ' acres'}
                  </Text>
                  <Text style={styles.farmMeta}>
                    {(farm.boundary_length_m ?? 0).toFixed(0)}m boundary · {farm.boundary.length} points
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </View>
            </GlassCard>
          </Pressable>
        ))}

        {farms.length === 0 && !loading && (
          <GlassCard>
            <Text style={styles.empty}>Tap "MAP NEW FARM" above. Walk the field edge with GPS.</Text>
          </GlassCard>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.neonSoft },
  icon: { fontSize: 24 },
  farmName: { ...typography.body, color: palette.text, fontWeight: '800', fontSize: 17 },
  farmSub: { ...typography.caption, color: palette.neon, marginTop: 4, fontWeight: '600' },
  farmMeta: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  chev: { color: palette.textDim, fontSize: 26 },
  empty: { ...typography.body, color: palette.textMuted, textAlign: 'center', lineHeight: 22 },
});
