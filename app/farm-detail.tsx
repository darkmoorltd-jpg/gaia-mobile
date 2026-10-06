
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, GlassCard, NeonButton, Pill } from '../src/components';
import { GoogleMap } from '../src/components/GoogleMap';
import { loadFarms, deleteFarm, enclosedArea } from '../src/utils/farms';
import { palette, typography, spacing, radius, shadows } from '../src/theme';

interface Point { latitude: number; longitude: number; }

interface Farm {
  id: string;
  name: string;
  crop?: string;
  boundary: string;
  area_acres?: number;
  created_at?: string;
}

export default function FarmDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const all = await loadFarms();
      const found = all.find((f: Farm) => f.id === id) || null;
      setFarm(found);
      if (found?.boundary) {
        try {
          const parsed = JSON.parse(found.boundary);
          if (Array.isArray(parsed)) setPoints(parsed);
        } catch {
          // ignore malformed boundary
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete farm?',
      'This will permanently remove the boundary.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!farm) return;
            const ok = await deleteFarm(farm.id);
            if (ok) {
              router.replace('/farms');
            } else {
              Alert.alert('Delete failed');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen glow="crops">
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} size="large" />
          <Text style={styles.loadingText}>Loading farm…</Text>
        </View>
      </Screen>
    );
  }

  if (!farm) {
    return (
      <Screen glow="crops">
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🚫</Text>
          <Text style={styles.emptyText}>Farm not found</Text>
          <NeonButton
            label="BACK TO FARMS"
            onPress={() => router.replace('/farms')}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </Screen>
    );
  }

  const area = farm.area_acres ?? (enclosedArea(points) / 4046.86);
  const created = farm.created_at
    ? new Date(farm.created_at).toLocaleDateString()
    : '—';

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Pill label="Farm" />
            <Text style={styles.title}>{farm.name}</Text>
            {farm.crop ? (
              <Text style={styles.subtitle}>{farm.crop}</Text>
            ) : null}
          </View>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{points.length}</Text>
              <Text style={styles.statLbl}>POINTS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{area.toFixed(3)}</Text>
              <Text style={styles.statLbl}>ACRES</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{(area * 0.404686).toFixed(2)}</Text>
              <Text style={styles.statLbl}>HECTARES</Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.mapBox}>
          <GoogleMap points={points} height={360} closed={true} />
        </View>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>CREATED</Text>
          <Text style={styles.value}>{created}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>FARM ID</Text>
          <Text style={styles.valueMono}>{farm.id}</Text>

          {farm.crop ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.label}>PRIMARY CROP</Text>
              <Text style={styles.value}>{farm.crop}</Text>
            </>
          ) : null}
        </GlassCard>

        <View style={{ height: spacing.lg }} />

        <NeonButton
          label="RE-MAP BOUNDARY"
          variant="ghost"
          onPress={() => router.push('/farm-mapping')}
        />

        <View style={{ height: spacing.sm }} />

        <NeonButton
          label="DELETE FARM"
          variant="danger"
          onPress={handleDelete}
        />

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    ...typography.body,
    color: palette.textMuted,
    marginTop: spacing.lg,
  },
  emptyIcon: { fontSize: 64 },
  emptyText: {
    ...typography.body,
    color: palette.textMuted,
    marginTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: palette.text,
    letterSpacing: -1,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: palette.neon,
    marginTop: 4,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  closeText: { color: palette.textMuted, fontSize: 16, fontWeight: '700' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.neon,
    letterSpacing: -0.5,
  },
  statLbl: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  mapBox: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: palette.borderHi,
    ...shadows.neon,
  },
  label: { ...typography.micro, color: palette.textMuted, marginBottom: 6 },
  value: { ...typography.body, color: palette.text, fontWeight: '600' },
  valueMono: {
    ...typography.mono,
    color: palette.text,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.md,
  },
});
