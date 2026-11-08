import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function AdminInputs() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [stats, setStats] = useState<any | null>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_input_overview');
      if (!error) setStats(data || {});
    } catch {}
    setBusy(false); setRef(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const s = stats || {};

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Input Marketplace</Text>
        <Text style={styles.sub}>Platform-wide metrics</Text>

        {busy && !stats ? <ActivityIndicator color="#b388ff" style={{ marginTop: 30 }} /> : null}

        {stats ? (
          <>
            <Text style={styles.sectionLabel}>💰 MONEY FLOW</Text>
            <View style={styles.grid}>
              <KPI label="GMV (Gross Merch. Value)" value={money(s.gmv_total_ngn)} styles={styles} accent="#b388ff" />
              <KPI label="Escrow Held" value={money(s.escrow_held_ngn)} styles={styles} accent="#ffb300" />
              <KPI label="Released to Sellers" value={money(s.released_ngn)} styles={styles} accent="#00ff88" />
              <KPI label="Refunded" value={money(s.refunded_ngn)} styles={styles} accent="#ff3b5c" />
              <KPI label="Subscription Revenue" value={money(s.subscription_revenue_ngn)} styles={styles} accent="#00ff88" />
              <KPI label="Payouts Pending" value={money(s.withdrawals_pending_ngn)} styles={styles} accent="#ffb300" />
            </View>

            <Text style={styles.sectionLabel}>🏪 PROVIDERS</Text>
            <View style={styles.grid}>
              <KPI label="Total" value={s.providers_total ?? 0} styles={styles} />
              <KPI label="Active" value={s.providers_active ?? 0} styles={styles} accent="#00ff88" />
              <KPI label="Pending" value={s.providers_pending ?? 0} styles={styles} accent="#ffb300" />
              <KPI label="Rejected" value={s.providers_rejected ?? 0} styles={styles} accent="#ff3b5c" />
            </View>

            <Text style={styles.sectionLabel}>📦 PRODUCTS & ORDERS</Text>
            <View style={styles.grid}>
              <KPI label="Active Products" value={s.products_active ?? 0} styles={styles} />
              <KPI label="Total Orders" value={s.orders_total ?? 0} styles={styles} />
              <KPI label="Pending Ship" value={s.orders_pending ?? 0} styles={styles} accent="#ffb300" />
              <KPI label="In Transit" value={s.orders_shipped ?? 0} styles={styles} accent="#4fc3f7" />
              <KPI label="Delivered" value={s.orders_delivered ?? 0} styles={styles} accent="#00ff88" />
              <KPI label="Cancelled" value={s.orders_cancelled ?? 0} styles={styles} accent="#ff3b5c" />
            </View>

            <Text style={styles.sectionLabel}>🔄 WITHDRAWALS</Text>
            <View style={styles.grid}>
              <KPI label="Pending Requests" value={s.withdrawals_pending_count ?? 0} styles={styles} accent="#ffb300" />
              <KPI label="Total Paid Out" value={money(s.withdrawals_paid_ngn)} styles={styles} accent="#00ff88" />
            </View>

            {(s.top_providers || []).length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>🏆 TOP PROVIDERS (by paid revenue)</Text>
                {(s.top_providers || []).map((p: any, i: number) => (
                  <View key={i} style={styles.topCard}>
                    <View style={styles.rankBadge}><Text style={styles.rankText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topName}>{p.name}</Text>
                      <Text style={styles.topMeta}>{p.orders} delivered order{p.orders === 1 ? '' : 's'}</Text>
                    </View>
                    <Text style={styles.topRevenue}>{money(p.revenue_ngn)}</Text>
                  </View>
                ))}
              </>
            ) : null}

            <Text style={styles.sectionLabel}>⚡ QUICK ACTIONS</Text>
            <Pressable onPress={() => router.push('/admin-input-providers' as any)} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>🏪</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Manage Providers</Text>
                <Text style={styles.actionSub}>Approve · Reject · God mode detail</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/admin-provider-payouts' as any)} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>💸</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Settle Payouts</Text>
                <Text style={styles.actionSub}>
                  {s.withdrawals_pending_count ?? 0} pending request{(s.withdrawals_pending_count ?? 0) === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/inputs' as any)} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>🛒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Browse as Buyer</Text>
                <Text style={styles.actionSub}>See the platform like a farmer</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </Pressable>
          </>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function KPI({ label, value, styles, accent }: any) {
  return (
    <View style={[styles.kpi, accent ? { borderColor: accent } : null]}>
      <Text style={[styles.kpiValue, accent ? { color: accent } : null]} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff', marginTop: 24, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flex: 1, minWidth: '31%', padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  kpiValue: { fontSize: 18, fontWeight: '900', color: p.text },
  kpiLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: p.textMuted, marginTop: 4 },
  topCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(179,136,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '900', color: '#b388ff' },
  topName: { fontSize: 14, fontWeight: '800', color: p.text },
  topMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  topRevenue: { fontSize: 15, fontWeight: '900', color: '#00ff88' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  actionIcon: { fontSize: 22 },
  actionTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  actionSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  actionChevron: { fontSize: 22, color: p.textDim },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
