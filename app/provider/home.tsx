import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function ProviderHome() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const signOut = useAuth((s: any) => s.signOut);

  const [stats, setStats] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [d, s] = await Promise.all([
        supabase.rpc('provider_dashboard'),
        supabase.rpc('input_provider_status'),
      ]);
      if (!d.error) setStats(d.data);
      if (!s.error) setStatus(s.data);
    } catch {}
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = async () => { await signOut(); router.replace('/(auth)/login'); };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={styles.badgeDot} />
              <Text style={styles.badge}>INPUT PROVIDER</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>{status?.business_name || 'My Business'}</Text>
            <View style={[styles.statusChip, {
              borderColor: status?.status === 'active' ? '#00ff88' : status?.status === 'rejected' ? '#ff3b5c' : '#ffb300'
            }]}>
              <Text style={[styles.statusText, {
                color: status?.status === 'active' ? '#00ff88' : status?.status === 'rejected' ? '#ff3b5c' : '#ffb300'
              }]}>{String(status?.status || 'pending').toUpperCase()}</Text>
            </View>
          </View>
          <Pressable onPress={logout} style={styles.logout}>
            <Text style={styles.logoutText}>EXIT</Text>
          </Pressable>
        </View>

        {status?.status === 'pending' && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingTitle}>⏳ Pending Approval</Text>
            <Text style={styles.pendingBody}>Your application is being reviewed. You'll be able to add products once approved.</Text>
          </View>
        )}

        {status?.status === 'rejected' && (
          <View style={styles.rejectedBox}>
            <Text style={styles.pendingTitle}>❌ Application Rejected</Text>
            <Text style={styles.pendingBody}>{status.rejection_reason || 'Contact support for details.'}</Text>
          </View>
        )}

        {status?.status === 'active' && (
          <>
            <LinearGradient colors={['#7c4dff', '#b388ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.earnCard}>
              <Text style={styles.earnLabel}>TOTAL REVENUE (PAID)</Text>
              <Text style={styles.earnVal}>{money(stats?.revenue_paid_ngn)}</Text>
              <View style={styles.earnRow}>
                <View style={styles.earnCol}><Text style={styles.earnColVal}>{money(stats?.revenue_pending_ngn)}</Text><Text style={styles.earnColLbl}>PENDING</Text></View>
                <View style={styles.earnDiv} />
                <View style={styles.earnCol}><Text style={styles.earnColVal}>{stats?.products_count ?? 0}</Text><Text style={styles.earnColLbl}>PRODUCTS</Text></View>
                <View style={styles.earnDiv} />
                <View style={styles.earnCol}><Text style={styles.earnColVal}>{stats?.orders_pending ?? 0}</Text><Text style={styles.earnColLbl}>TO FULFILL</Text></View>
              </View>
            </LinearGradient>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => router.push('/provider/products' as any)} style={styles.bigBtn}>
                <Text style={styles.bigBtnTitle}>+ ADD PRODUCT</Text>
                <Text style={styles.bigBtnSub}>List new input</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/provider/orders' as any)} style={styles.bigBtn}>
                <Text style={styles.bigBtnTitle}>VIEW ORDERS</Text>
                <Text style={styles.bigBtnSub}>{stats?.orders_pending || 0} pending</Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#b388ff' },
  badge: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#b388ff' },
  name: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 4 },
  statusChip: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  logout: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: p.danger },
  logoutText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
  pendingBox: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,179,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.4)', marginBottom: 16 },
  rejectedBox: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,59,92,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.4)', marginBottom: 16 },
  pendingTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  pendingBody: { fontSize: 12, color: p.textMuted, marginTop: 6, lineHeight: 18 },
  earnCard: { borderRadius: 24, padding: 24, marginTop: 8 },
  earnLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  earnVal: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: -1.5, marginTop: 4 },
  earnRow: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  earnCol: { flex: 1, alignItems: 'center' },
  earnColVal: { fontSize: 15, fontWeight: '900', color: '#fff' },
  earnColLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  earnDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  bigBtn: { flex: 1, padding: 18, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5, borderColor: '#b388ff', alignItems: 'center' },
  bigBtnTitle: { fontSize: 13, fontWeight: '900', color: '#b388ff', letterSpacing: 1 },
  bigBtnSub: { fontSize: 10, color: p.textMuted, marginTop: 4 },
});
