import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { GoogleMap } from '../src/components/GoogleMap';

export default function AgentFieldMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await supabase.rpc('agent_field_map');
      setRows(data || []);
    } catch {}
    setBusy(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const points = rows.map((r) => ({ latitude: r.gps_lat, longitude: r.gps_lon }));
  const center = points.length > 0 ? points[0] : { latitude: 9.0765, longitude: 7.3986 };
  const verified = rows.filter((r) => r.status === 'verified').length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Field Map</Text>
        <Text style={styles.sub}>{rows.length} farmer locations · {verified} verified</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {rows.length > 0 ? (
          <View style={styles.mapBox}>
            <GoogleMap points={points} center={center} height={420} />
          </View>
        ) : !busy ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No GPS-tagged farmers yet</Text>
            <Text style={styles.emptySub}>
              When you register farmers with GPS in the register screen, they'll appear here.
            </Text>
          </View>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>FARMERS ({rows.length})</Text>
            {rows.slice(0, 30).map((r) => (
              <View key={r.user_id} style={styles.card}>
                <View style={[styles.dot, { backgroundColor: r.status === 'verified' ? palette.neon : palette.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {r.crop || '—'} · {r.state || '—'}{r.lga ? ' / ' + r.lga : ''}
                  </Text>
                </View>
                <Text style={styles.statusLbl}>{(r.status || '').toUpperCase()}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  mapBox: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: p.borderHi, marginBottom: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: p.text, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginBottom: 10, marginTop: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 14, fontWeight: '700', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  statusLbl: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
});
