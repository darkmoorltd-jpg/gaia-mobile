import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { useBoaAccess } from '../src/hooks/useBoaAccess';

export default function BoaPortal() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const [ref, setRef] = useState(false);
  const { role, loading, hasAccess, isAdmin, isManager } = useBoaAccess();

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  if (!hasAccess) {
    return (
      <View style={styles.center}>
        <Text style={styles.blockedTitle}>BOA Access Required</Text>
        <Text style={styles.blockedText}>Contact GAIA admin to request Bank of Agriculture access.</Text>
        <Pressable onPress={() => router.back()} style={styles.blockedBtn}>
          <Text style={styles.blockedBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const ADMIN_SECTIONS = [
    { title: '🔐 ADMIN', color: '#ff3b5c', items: [
      { icon: '⚙️', label: 'Portfolio', route: '/boa-dashboard' },
      { icon: '👥', label: 'Borrowers', route: '/boa-borrowers' },
      { icon: '👨‍🌾', label: 'Officers', route: '/boa-field-officers' },
      { icon: '🌾', label: 'Coops', route: '/boa-coops' },
    ]},
    { title: '📊 EXECUTIVE', color: '#00ff88', items: [
      { icon: '📄', label: 'Board Pack', route: '/boa-board-pack' },
      { icon: '💹', label: 'Pricing', route: '/boa-pricing' },
      { icon: '📈', label: 'Collections', route: '/boa-forecast' },
      { icon: '📊', label: 'Benchmark', route: '/boa-benchmark' },
    ]},
    { title: '⚠️ RISK', color: '#ffb300', items: [
      { icon: '🔍', label: 'Fraud', route: '/boa-fraud' },
      { icon: '🚨', label: 'Risk Radar', route: '/boa-risk' },
      { icon: '🔧', label: 'Restructure', route: '/boa-restructure' },
      { icon: '🗺️', label: 'Map', route: '/boa-map' },
    ]},
    { title: '🌾 OPS', color: '#4fc3f7', items: [
      { icon: '➕', label: 'Onboard', route: '/boa-onboard' },
      { icon: '📸', label: 'Visit', route: '/boa-visit' },
      { icon: '📥', label: 'CSV Import', route: '/boa-csv-import' },
      { icon: '🍚', label: 'Food Sec', route: '/boa-food-security' },
    ]},
  ];

  const MANAGER_SECTIONS = [
    { title: '📊 PORTFOLIO', color: '#00ff88', items: [
      { icon: '📊', label: 'Dashboard', route: '/boa-dashboard' },
      { icon: '👥', label: 'Borrowers', route: '/boa-borrowers' },
      { icon: '🌾', label: 'Coops', route: '/boa-coops' },
      { icon: '👨‍🌾', label: 'Officers', route: '/boa-field-officers' },
    ]},
    { title: '⚠️ RISK', color: '#ffb300', items: [
      { icon: '🚨', label: 'Risk Radar', route: '/boa-risk' },
      { icon: '🔍', label: 'Fraud', route: '/boa-fraud' },
      { icon: '📈', label: 'Collections', route: '/boa-forecast' },
      { icon: '🔧', label: 'Restructure', route: '/boa-restructure' },
    ]},
    { title: '🌾 OPS', color: '#4fc3f7', items: [
      { icon: '➕', label: 'Onboard', route: '/boa-onboard' },
      { icon: '📥', label: 'CSV Import', route: '/boa-csv-import' },
      { icon: '🗺️', label: 'Map', route: '/boa-map' },
      { icon: '📦', label: 'Warehouse', route: '/boa-receipts' },
    ]},
    { title: '📄 REPORTS', color: '#c68a5c', items: [
      { icon: '🍚', label: 'Food Sec', route: '/boa-food-security' },
      { icon: '📊', label: 'Benchmark', route: '/boa-benchmark' },
      { icon: '📄', label: 'Board Pack', route: '/boa-board-pack' },
      { icon: '💹', label: 'Pricing', route: '/boa-pricing' },
    ]},
  ];

  const OFFICER_SECTIONS = [
    { title: '🚴 MY DAY', color: '#00ff88', items: [
      { icon: '🚴', label: 'My Route', route: '/boa-officer-home' },
      { icon: '👥', label: 'Farmers', route: '/boa-borrowers' },
      { icon: '📸', label: 'Log Visit', route: '/boa-visit' },
      { icon: '➕', label: 'Onboard', route: '/boa-onboard' },
    ]},
  ];

  const SECTIONS = isAdmin ? ADMIN_SECTIONS : isManager ? MANAGER_SECTIONS : OFFICER_SECTIONS;
  const roleLabel = isAdmin ? 'ADMIN' : isManager ? 'MANAGER' : 'FIELD OFFICER';
  const roleColor = isAdmin ? '#ff3b5c' : isManager ? '#00ff88' : '#4fc3f7';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => setRef(false)} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>BANK OF AGRICULTURE</Text>
        <Text style={styles.title}>BOA Portal</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 24 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: roleColor }} />
          <Text style={{ fontSize: 11, fontWeight: '800', color: roleColor, letterSpacing: 1.5 }}>
            {roleLabel} · {user?.email}
          </Text>
        </View>

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
