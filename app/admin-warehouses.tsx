import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminWarehouses() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [kpi, setKpi] = useState<any>({});
  const [companies, setCompanies] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<'pending'|'approved'|'all'>('pending');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [{ data: k }, { data: c }] = await Promise.all([
      supabase.rpc('admin_warehouse_kpi'),
      supabase.from('warehouse_companies').select('*').order('created_at', { ascending: false }),
    ]);
    setKpi(k || {});
    setCompanies(c || []);
    setBusy(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const verify = async (company: any, action: 'approved' | 'rejected') => {
    const title = action === 'approved' ? 'Approve?' : 'Reject?';
    Alert.alert(title, company.company_name, [
      { text: 'Cancel', style: 'cancel' },
      { text: action === 'approved' ? 'Approve' : 'Reject', style: action === 'rejected' ? 'destructive' : 'default',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_verify_warehouse', {
            p_company_id: company.id, p_action: action,
            p_reason: action === 'rejected' ? 'Incomplete documents' : null,
          });
          if (error) { Alert.alert('Failed', error.message); return; }
          load();
        }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const filtered = tab === 'all' ? companies : companies.filter(c => c.verification_status === tab);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Warehouse Admin</Text>
        <Text style={styles.sub}>Verify companies · track revenue</Text>

        <Text style={styles.sectionLabel}>REVENUE</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}><Text style={styles.kpiVal}>₦{Number(kpi.onboarding_revenue || 0).toLocaleString()}</Text><Text style={styles.kpiLbl}>ONBOARDING</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiVal}>₦{Number(kpi.listing_revenue || 0).toLocaleString()}</Text><Text style={styles.kpiLbl}>LISTINGS</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiVal}>₦{Number(kpi.commission_earned || 0).toLocaleString()}</Text><Text style={styles.kpiLbl}>COMMISSION</Text></View>
        </View>

        <Text style={styles.sectionLabel}>PLATFORM</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}><Text style={styles.kpiVal}>{kpi.total_companies || 0}</Text><Text style={styles.kpiLbl}>COMPANIES</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiVal}>{kpi.listed_units || 0}</Text><Text style={styles.kpiLbl}>LIVE UNITS</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiVal}>{kpi.total_bookings || 0}</Text><Text style={styles.kpiLbl}>BOOKINGS</Text></View>
        </View>

        <View style={styles.tabRow}>
          {(['pending','approved','all'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab===t && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab===t && { color: '#000' }]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && filtered.length === 0 ? <Text style={styles.empty}>No companies in this tab.</Text> : null}

        {filtered.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.companyName}>{c.company_name}</Text>
              <View style={[styles.badge, { borderColor: c.verification_status === 'approved' ? palette.neon : c.verification_status === 'pending' ? '#ffb300' : '#ff3b5c' }]}>
                <Text style={[styles.badgeTxt, { color: c.verification_status === 'approved' ? palette.neon : c.verification_status === 'pending' ? '#ffb300' : '#ff3b5c' }]}>
                  {c.verification_status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>CAC: {c.cac_registration || '—'}</Text>
            <Text style={styles.meta}>📍 {c.head_office_state || '—'}</Text>
            <Text style={styles.meta}>📞 {c.contact_phone || '—'}</Text>
            <Text style={styles.meta}>✉️ {c.contact_email || '—'}</Text>
            <Text style={styles.meta}>💼 {c.years_in_business} years · {c.onboarding_fee_paid ? '✓ Paid ₦100k' : '⚠ Onboarding pending'}</Text>

            {c.verification_status === 'pending' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable onPress={() => verify(c, 'approved')} style={[styles.actionBtn, { borderColor: palette.neon, flex: 1 }]}>
                  <Text style={[styles.actionTxt, { color: palette.neon }]}>APPROVE</Text>
                </Pressable>
                <Pressable onPress={() => verify(c, 'rejected')} style={[styles.actionBtn, { borderColor: '#ff3b5c', flex: 1 }]}>
                  <Text style={[styles.actionTxt, { color: '#ff3b5c' }]}>REJECT</Text>
                </Pressable>
              </View>
            ) : null}
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
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpi: { flex: 1, backgroundColor: p.surface, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: p.border },
  kpiVal: { fontSize: 14, fontWeight: '900', color: p.neon },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 0.5 },
  tabRow: { flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabTxt: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  companyName: { fontSize: 15, fontWeight: '900', color: p.text, flex: 1 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  actionBtn: { paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
