import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

type Tab = 'patients' | 'vitals' | 'scans';

export default function AdminDrVinc() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [tab, setTab] = useState<Tab>('patients');
  const [patients, setPatients] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    
    // We use the service role key for admin, but since this is mobile, we assume RLS allows admin.
    // Fetch Profiles + Subs
    const { data: subs } = await supabase.from('care_subscriptions').select('*, user_id').eq('status', 'active');
    const userIds = (subs || []).map((s: any) => s.user_id);
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('client_health_profiles').select('*').in('user_id', userIds);
      const { data: profiles_full } = await supabase.from('user_profiles').select('user_id, first_name, last_name, email').in('user_id', userIds);
      
      const merged = (subs || []).map((s: any) => {
        const p = (profiles || []).find((x: any) => x.user_id === s.user_id) || {};
        const profileInfo = (profiles_full || []).find((x: any) => x.user_id === s.user_id) || {};
        const name = [profileInfo.first_name, profileInfo.last_name].filter(Boolean).join(' ') || profileInfo.email || s.user_id.slice(0, 8);
        return { ...s, ...p, name };
      });
      setPatients(merged);
    }

    // Fetch Vitals
    const { data: v } = await supabase.from('daily_checkins').select('*').order('created_at', { ascending: false }).limit(50);
    setVitals(v || []);

    // Fetch Scans
    const { data: sc } = await supabase.from('meal_scans').select('*').order('created_at', { ascending: false }).limit(50);
    setScans(sc || []);

    setBusy(false);
    setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Dr. Vinc Admin</Text>
        <Text style={styles.sub}>Manage clinical patients and AI insights</Text>

        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab('patients')} style={[styles.tabBtn, tab === 'patients' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'patients' && styles.tabTextOn]}>PATIENTS</Text>
          </Pressable>
          <Pressable onPress={() => setTab('vitals')} style={[styles.tabBtn, tab === 'vitals' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'vitals' && styles.tabTextOn]}>VITALS</Text>
          </Pressable>
          <Pressable onPress={() => setTab('scans')} style={[styles.tabBtn, tab === 'scans' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'scans' && styles.tabTextOn]}>MEAL SCANS</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {tab === 'patients' && patients.map((p, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardTitle}>{p.condition}</Text>
            <Text style={styles.cardMeta}>Patient: {p.name}</Text>
            <Text style={styles.cardMeta}>Weight: {p.current_weight_kg || '—'} kg</Text>
            <Text style={styles.cardMeta}>Restrictions: {p.dietary_restrictions?.join(', ') || 'None'}</Text>
            <Text style={styles.cardMeta}>Plan: {p.plan || 'Active'}</Text>
          </View>
        ))}

        {tab === 'vitals' && vitals.map((v, i) => (
          <View key={i} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.cardTitle}>BP: {v.systolic_bp || '?'}/{v.diastolic_bp || '?'}</Text>
              <Text style={styles.cardMeta}>{new Date(v.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.cardMeta}>Blood Sugar: {v.blood_sugar_mgdl || '?'} mg/dL</Text>
            <Text style={styles.cardMeta}>User ID: {v.user_id.slice(0, 8)}...</Text>
          </View>
        ))}

        {tab === 'scans' && scans.map((s, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardTitle}>Scan for: {s.condition}</Text>
            <Text style={styles.cardMeta}>{new Date(s.created_at).toLocaleString()}</Text>
            <Text style={{ fontSize: 12, color: palette.text, marginTop: 8, lineHeight: 18 }}>
              {s.analysis}
            </Text>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 10, fontWeight: '900', color: p.textDim, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: p.text },
  cardMeta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
});
