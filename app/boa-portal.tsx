import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function BoaPortal() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [role, setRole] = useState<string>('manager');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const check = useCallback(async () => {
    if (!user) { setHasAccess(false); setBusy(false); return; }
    setBusy(true);
    const { data } = await supabase.rpc('is_boa_viewer');
    const { data: prof } = await supabase.from('user_profiles').select('role').eq('user_id', user.id).maybeSingle();
    if (prof?.role) setRole(prof.role);
    setHasAccess(!!data);
    setBusy(false); setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { check(); }, [check]));

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  if (!hasAccess) {
    return (
      <View style={styles.center}>
        <Text style={styles.blockedTitle}>BOA Access Required</Text>
        <Text style={styles.blockedText}>
          Your account does not have Bank of Agriculture access. Contact GAIA admin to request access.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.blockedBtn}>
          <Text style={styles.blockedBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const MANAGER_SECTIONS = [
    { title: 'PORTFOLIO', color: '#00ff88', items: [
      { icon: '📊', label: 'Dashboard', route: '/boa-dashboard' },
      { icon: '👥', label: 'Borrowers', route: '/boa-borrowers' },
      { icon: '🌾', label: 'Cooperatives', route: '/boa-coops' },
      { icon: '👨‍🌾', label: 'Field Officers', route: '/boa-field-officers' },
    ]},
    { title: 'OPERATIONS', color: '#ffb300', items: [
      { icon: '➕', label: 'Onboard Customer', route: '/boa-onboard' },
      { icon: '📸', label: 'Field Visit', route: '/boa-visit' },
      { icon: '📥', label: 'CSV Import', route: '/boa-csv-import' },
      { icon: '🔧', label: 'Restructure', route: '/boa-restructure' },
    ]},
    { title: 'RISK & ANALYTICS', color: '#ff3b5c', items: [
      { icon: '⚠️', label: 'Risk Radar', route: '/boa-risk' },
      { icon: '🔍', label: 'Fraud Rings', route: '/boa-fraud' },
      { icon: '📈', label: 'Collections', route: '/boa-forecast' },
      { icon: '💹', label: 'Pricing', route: '/boa-pricing' },
    ]},
    { title: 'INSIGHTS', color: '#4fc3f7', items: [
      { icon: '🗺️', label: 'Portfolio Map', route: '/boa-map' },
      { icon: '🍚', label: 'Food Security', route: '/boa-food-security' },
      { icon: '📦', label: 'Warehouse Receipts', route: '/boa-receipts' },
      { icon: '📊', label: 'Peer Benchmark', route: '/boa-benchmark' },
      { icon: '📄', label: 'Board Pack', route: '/boa-board-pack' },
    ]},
  ];

  const OFFICER_SECTIONS = [
    { title: 'MY DAY', color: '#00ff88', items: [
      { icon: '🚴', label: 'Route Today', route: '/boa-officer-home' },
      { icon: '👥', label: 'My Farmers', route: '/boa-borrowers' },
      { icon: '📸', label: 'Field Visit', route: '/boa-visit' },
      { icon: '➕', label: 'Onboard Customer', route: '/boa-onboard' },
    ]},
  ];

  const SECTIONS = role === 'boa_officer' ? OFFICER_SECTIONS : MANAGER_SECTIONS;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); check(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>BANK OF AGRICULTURE</Text>
        <Text style={styles.title}>BOA Portal</Text>
        <Text style={styles.sub}>Powered by GAIA · {user?.email}</Text>

        {SECTIONS.map((sec, si) => (
          <View key={si} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: sec.color }]}>{sec.title}</Text>
            <View style={styles.grid}>
              {sec.items.map((item, ii) => (
                <Pressable key={ii} onPress={() => router.push(item.route as any)} style={styles.card}>
                  <Text style={styles.icon}>{item.icon}</Text>
                  <Text style={styles.label}>{item.label}</Text>
                </Pressable>
              ))}
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
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3, color: '#00ff88' },
  title: { fontSize: 34, fontWeight: '900', color: p.text, letterSpacing: -1.2, marginTop: 4 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '31.5%', padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  icon: { fontSize: 24, marginBottom: 6 },
  label: { fontSize: 10, fontWeight: '800', color: p.text, textAlign: 'center', letterSpacing: 0.3 },
  center: { flex: 1, backgroundColor: p.obsidian, justifyContent: 'center', alignItems: 'center', padding: 30 },
  blockedTitle: { fontSize: 22, fontWeight: '900', color: p.danger, marginBottom: 10 },
  blockedText: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20 },
  blockedBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  blockedBtnText: { fontSize: 12, fontWeight: '900', color: p.text, letterSpacing: 1 },
});
