import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function BoaFieldOfficers() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_field_officer_roster', { p_zone: null });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalVisits = rows.reduce((s, r) => s + Number(r.visits_30d || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Field Officers</Text>
        <Text style={styles.sub}>{rows.length} active · {totalVisits} visits in 30d</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {rows.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No field officers registered yet.</Text>
            <Text style={styles.kv} style={{ marginTop: 6, fontSize: 11 }}>
              Add rows to boa_field_officers to see the roster here.
            </Text>
          </View>
        ) : rows.map((o, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(o.full_name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{o.full_name}</Text>
                <Text style={styles.cardMeta}>{o.zone || '-'} · {o.phone || '-'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.visits}>{o.visits_30d}</Text>
                <Text style={styles.visitsLbl}>VISITS</Text>
              </View>
            </View>
            {o.phone ? (
              <View style={styles.actions}>
                <Pressable onPress={() => Linking.openURL('tel:' + o.phone)} style={[styles.actionBtn, { borderColor: '#00ff88' }]}>
                  <Text style={[styles.actionTxt, { color: '#00ff88' }]}>CALL</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL('https://wa.me/' + String(o.phone).replace(/[^0-9]/g, ''))} style={[styles.actionBtn, { borderColor: '#25d366' }]}>
                  <Text style={[styles.actionTxt, { color: '#25d366' }]}>WHATSAPP</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 1, borderColor: '#00ff88', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900', color: '#00ff88' },
  cardName: { fontSize: 14, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  visits: { fontSize: 20, fontWeight: '900', color: '#00ff88' },
  visitsLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
