import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function AdminPartnerUsage() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('admin_partner_usage');
    setRows(data || []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Partner API</Text>
        <Text style={styles.sub}>{rows.length} registered partners · NDFR Section 12.5</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>No partner API keys yet.</Text>
            <Text style={styles.emptySub}>Create one via SQL: INSERT INTO partner_api_keys (partner_name, api_key, contact_email) VALUES (...)</Text>
          </View>
        ) : null}

        {rows.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.name}>{r.partner_name}</Text>
              <Text style={[styles.chip, { color: r.status === 'active' ? '#00ff88' : '#ffb300' }]}>{r.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.meta}>{r.contact_email || 'no contact'}</Text>
            <View style={styles.row}>
              <Text style={styles.k}>Used this month</Text>
              <Text style={styles.v}>{r.used} / {r.monthly_quota}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Billed (₦{r.per_call_price}/call)</Text>
              <Text style={styles.v}>₦{Number(r.billed || 0).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  empty: { padding: 20, alignItems: 'center' },
  emptyTxt: { fontSize: 14, color: p.textMuted },
  emptySub: { fontSize: 11, color: p.textDim, marginTop: 8, textAlign: 'center', lineHeight: 16 },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  chip: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  k: { fontSize: 12, color: p.textMuted },
  v: { fontSize: 12, fontWeight: '700', color: p.text },
});
