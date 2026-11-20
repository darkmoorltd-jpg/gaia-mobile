import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

export default function MinistryFarmers() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const LIMIT = 50;

  const load = useCallback(async (reset = true) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('ministry_farmers_list', {
      p_state_filter: stateFilter,
      p_search: search.trim() || null,
      p_limit: LIMIT,
      p_offset: reset ? 0 : offset,
    });
    if (!error) {
      setTotal(Number(data?.total || 0));
      setRows(reset ? (data?.rows || []) : [...rows, ...(data?.rows || [])]);
      if (!reset) setOffset(o => o + LIMIT);
    }
    setBusy(false);
  }, [stateFilter, search, rows, offset]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(true); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(true); }, [stateFilter, search]));

  const loadMore = async () => {
    if (busy || rows.length >= total) return;
    await load(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Farmers</Text>
        <Text style={styles.sub}>{total.toLocaleString()} total</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search name, phone, NIN..." placeholderTextColor={palette.textDim} style={styles.search} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}
        onScrollEndDrag={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          if (contentOffset.y + layoutMeasurement.height > contentSize.height - 200) loadMore();
        }}
        scrollEventThrottle={200}>
        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && rows.length === 0 ? <Text style={styles.empty}>No farmers found.</Text> : null}

        {rows.map((f: any, i: number) => (
          <Pressable key={f.user_id || i} onPress={() => router.push(`/ministry/farmer/${f.user_id}` as any)} style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{(f.full_name || 'U').charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{f.full_name || 'Unnamed'}</Text>
              <Text style={styles.meta} numberOfLines={1}>{[f.state, f.lga, f.ward].filter(Boolean).join(' · ') || 'No location'}</Text>
              <View style={styles.badges}>
                {f.nin_verified ? <Text style={styles.badgeOk}>✅ NIN</Text> : null}
                {f.farm_polygon_geojson ? <Text style={styles.badgeBlue}>🗺️ Polygon</Text> : null}
                {f.latest_ndvi_health ? <Text style={styles.badgeNdv}>{f.latest_ndvi_health === 'healthy' ? '🌱' : '⚠️'} {f.latest_ndvi_health}</Text> : null}
              </View>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}

        {rows.length > 0 && rows.length < total ? (
          <Text style={styles.loadMore}>{busy ? 'Loading…' : 'Scroll for more'}</Text>
        ) : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  search: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900', color: p.neon },
  name: { fontSize: 14, fontWeight: '900', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badgeOk: { fontSize: 9, color: p.neon, fontWeight: '900' },
  badgeBlue: { fontSize: 9, color: '#3b82f6', fontWeight: '900' },
  badgeNdv: { fontSize: 9, color: '#ffb300', fontWeight: '900' },
  chev: { fontSize: 24, color: p.textDim },
  loadMore: { fontSize: 11, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
});
