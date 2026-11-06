import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminOrganic() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [sellers, setSellers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<'sellers'|'orders'>('sellers');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [{ data: s }, { data: o }] = await Promise.all([
      supabase.from('organic_sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('organic_orders').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setSellers(s || []);
    setOrders(o || []);
    setBusy(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleCert = async (seller: any) => {
    const newVal = !seller.is_certified;
    Alert.alert(
      newVal ? 'Grant Certification?' : 'Revoke Certification?',
      seller.business_name,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: newVal ? 'Certify' : 'Revoke', onPress: async () => {
          await supabase.from('organic_sellers').update({
            is_certified: newVal,
            certification_expires_at: newVal ? new Date(Date.now() + 365*86400000).toISOString() : null,
          }).eq('id', seller.id);
          load();
        }},
      ],
    );
  };

  const suspend = async (seller: any) => {
    Alert.alert('Suspend seller?', seller.business_name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Suspend', style: 'destructive', onPress: async () => {
        await supabase.from('organic_sellers').update({ status: 'suspended' }).eq('id', seller.id);
        load();
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedTxt}>Access denied</Text></View>;

  const totalCommission = orders.filter(o => o.status === 'completed').reduce((s, o) => s + Number(o.gaia_fee), 0);
  const escrowTotal = orders.filter(o => o.status === 'escrow').reduce((s, o) => s + Number(o.gaia_fee), 0);
  const activeSellers = sellers.filter(s => s.status === 'active').length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Organic Admin</Text>
        <Text style={styles.sub}>Manage sellers · commissions · escrow</Text>

        <Text style={styles.sectionLabel}>REVENUE</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}><Text style={styles.kpiVal}>₦{totalCommission.toLocaleString()}</Text><Text style={styles.kpiLbl}>EARNED</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiVal}>₦{escrowTotal.toLocaleString()}</Text><Text style={styles.kpiLbl}>ESCROW</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiVal}>{activeSellers}</Text><Text style={styles.kpiLbl}>SELLERS</Text></View>
        </View>

        <View style={styles.tabRow}>
          {(['sellers','orders'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab === t && { color: '#000' }]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {tab === 'sellers' ? sellers.map(s => (
          <View key={s.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sellerName}>{s.business_name}</Text>
              <View style={[styles.badge, { borderColor: s.status === 'active' ? palette.neon : '#ff3b5c' }]}>
                <Text style={[styles.badgeTxt, { color: s.status === 'active' ? palette.neon : '#ff3b5c' }]}>{s.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.meta}>Tier: {s.tier_id.toUpperCase()} · 📍 {s.lga}, {s.state}</Text>
            <Text style={styles.meta}>Certified: {s.is_certified ? '✅ Yes' : '❌ No'}</Text>
            <Text style={styles.meta}>Expires: {s.subscription_expires_at ? new Date(s.subscription_expires_at).toLocaleDateString() : '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable onPress={() => toggleCert(s)} style={[styles.smallBtn, { borderColor: s.is_certified ? '#ffb300' : palette.neon, flex: 1 }]}>
                <Text style={[styles.smallTxt, { color: s.is_certified ? '#ffb300' : palette.neon }]}>{s.is_certified ? 'REVOKE CERT' : 'CERTIFY'}</Text>
              </Pressable>
              <Pressable onPress={() => suspend(s)} style={[styles.smallBtn, { borderColor: '#ff3b5c', flex: 1 }]}>
                <Text style={[styles.smallTxt, { color: '#ff3b5c' }]}>SUSPEND</Text>
              </Pressable>
            </View>
          </View>
        )) : orders.map(o => (
          <View key={o.id} style={styles.card}>
            <Text style={styles.sellerName}>Order #{o.id.slice(0,8)}</Text>
            <Text style={styles.meta}>Paid: ₦{Number(o.total_paid).toLocaleString()} · GAIA fee: ₦{Number(o.gaia_fee).toLocaleString()}</Text>
            <Text style={styles.meta}>Status: {o.status.toUpperCase()} · Rate: {(o.commission_rate * 100).toFixed(0)}%</Text>
            <Text style={styles.meta}>Release: {o.escrow_release_date ? new Date(o.escrow_release_date).toLocaleString() : '—'}</Text>
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
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 16, marginBottom: 8 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: p.surface, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: p.border },
  kpiVal: { fontSize: 14, fontWeight: '900', color: p.neon },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 0.5 },
  tabRow: { flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabTxt: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  sellerName: { fontSize: 15, fontWeight: '900', color: p.text, flex: 1 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  smallBtn: { paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  smallTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedTxt: { fontSize: 20, fontWeight: '900', color: p.danger },
});
