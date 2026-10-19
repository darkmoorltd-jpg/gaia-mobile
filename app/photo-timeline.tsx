import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';

const TYPE_LABEL: Record<string, string> = {
  crops: 'Crop', pests: 'Pest', soil: 'Soil', livestock: 'Livestock', video: 'Video',
};

export default function PhotoTimeline() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [days, setDays] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [window, setWindow] = useState(90);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await supabase.rpc('user_photo_timeline', { p_days: window });
      setDays(Array.isArray(data) ? data : []);
    } catch (e) { console.warn(e); }
    setBusy(false); setRef(false);
  }, [window]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalPhotos = days.reduce((sum: number, d: any) => sum + (d.scans || []).length, 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Photo Timeline</Text>
        <Text style={styles.sub}>{totalPhotos} photos · {days.length} days</Text>

        <View style={styles.filterRow}>
          {[30, 90, 180, 365].map((d) => (
            <Pressable
              key={d}
              onPress={() => setWindow(d)}
              style={[styles.chip, window === d && styles.chipOn]}
            >
              <Text style={[styles.chipText, window === d && styles.chipTextOn]}>{d}d</Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {!busy && days.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>Every scan with a photo becomes part of your farm story.</Text>
          </View>
        ) : null}

        {days.map((day, i) => (
          <View key={i} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayDate}>
                {new Date(day.scan_date).toLocaleDateString('en-NG', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
              <Text style={styles.dayCount}>{day.scan_count} scan{day.scan_count === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.grid}>
              {(day.scans || []).map((s: any) => (
                <View key={s.id} style={styles.photoCard}>
                  <Image source={{ uri: s.image_url }} style={styles.photo} />
                  <View style={styles.photoOverlay}>
                    <Text style={styles.photoLabel} numberOfLines={1}>{s.label || '—'}</Text>
                    <Text style={styles.photoMeta}>{TYPE_LABEL[s.type] || s.type} · {Math.round(s.confidence || 0)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { ...typography.heading, color: p.text, marginBottom: 8 },
  emptyText: { ...typography.body, color: p.textMuted, textAlign: 'center' },
  dayBlock: { marginBottom: 24 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayDate: { fontSize: 13, fontWeight: '800', color: p.text },
  dayCount: { fontSize: 11, color: p.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCard: { width: '48%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)' },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.65)' },
  photoLabel: { fontSize: 11, fontWeight: '800', color: '#fff' },
  photoMeta: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
