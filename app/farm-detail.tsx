import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Screen, GlassCard, Pill, LeafletMap } from '../src/components';
import { getFarm, Farm, farmCenter } from '../src/utils/farms';
import { palette, typography, spacing, radius, shadows } from '../src/theme';

export default function FarmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [farm, setFarm] = useState<Farm | null>(null);

  useFocusEffect(useCallback(() => {
    if (id) getFarm(id).then(setFarm);
  }, [id]));

  if (!farm) {
    return (
      <Screen glow="crops">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style);

={{ color: palette.textMuted }}>Loading…</Text>
         </View>
      </Screen>
    );
  }

  const center return = farmCenter(farm.boundary (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="FARM" />
        <Text style={styles.title}>{farm.name}</Text>
        {farm.crop ? <Text style={styles.crop}>{farm.crop}</Text> : null}

        <View style={styles.mapBox}>
          <LeafletMap points={farm.boundary} center={center} height={300} zoom={18} />
        </View>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <View style={styles.grid}>
            <View style={styles.cell}><Text style={styles.cellVal}>{(farm.area_acres ?? 0).toFixed(3)}</Text><Text style={styles.cellLbl}>ACRES</Text></View>
            <View style={styles.cell}><Text style={styles.cellVal}>{(farm.area_hectares ?? 0).toFixed(3)}</Text><Text style={styles.cellLbl}>HECTARES</Text></View>
            <View style={styles.cell}><Text style={styles.cellVal}>{(farm.boundary_length_m ?? 0).toFixed(0)}</Text><Text style={styles.cellLbl}>METERS</Text></View>
          </View>
        </GlassCard>

        <GlassCard style={{ marginTop: spacing.md }}>
          <Text style={styles.detailLabel}>POINTS</Text>
          <Text style={styles.detailVal}>{farm.boundary.length}</Text>
          <View style={{ height: spacing.md }} />
          <Text style={styles.detailLabel}>CREATED</Text>
          <Text style={styles.detailVal}>
            {farm.created_at ? new Date(farm.created_at).toLocaleString() : '—'}
          </Text>
        </GlassCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm },
  crop: { ...typography.body, color: palette.neon, marginTop: 4, fontWeight: '600' },
  mapBox: { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.lg, borderWidth: 1, borderColor: palette.borderHi, ...shadows.neon },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', flex: 1 },
  cellVal: { fontSize: 22, fontWeight: '900', color: palette.neon, letterSpacing: -0.5 },
  cellLbl: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  detailLabel: { ...typography.micro, color: palette.textMuted },
  detailVal: { ...typography.body, color: palette.text, marginTop: 4, fontWeight: '600' },
});
