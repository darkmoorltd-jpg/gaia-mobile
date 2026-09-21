import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme, spacing, typography, radius } from '../src/theme';
import { Pill, GlassCard, NeonButton } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

type Tab = 'overview' | 'farmers' | 'crops' | 'sales';

export default function B2BDashboard() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>({});
  const [farmers, setFarmers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const { data: users } = await supabase.from('user_scans').select('*').limit(500);
    const { data: scans } = await supabase.from('scan_history').select('*').limit(1000);
    const { data: profiles } = await supabase.from('user_profiles').select('*').limit(500);
    const { data: payments }*').limit(500);

    const total = users?.length || 0;
    const active = scans?.filter((s) => new Date(s.created_at) > new Date(Date.now() - 30 * 86400000)).length || 0;
    const revenue = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0) / 100;

    setStats({ total, active, revenue, scans: scans?.length || 0 });

    // Top crops
    const cropCount: any = {};
    (scans || []).forEach((s) => {
      const c = s.target || 'unknown';
      cropCount[c] = (cropCount[c] || 0) + 1;
    });
    setCrops(Object.entries(cropCount).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10));

    setFarmers(profiles || []);
  };

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.blocked}>B2B dashboard is admin-only</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="B2B Intelligence" color={palette.livestock} />
        <Text style={styles.title}>Enterprise Dashboard</Text>
        <Text style={styles.subtitle}>Real-time agricultural data across Nigeria</Text>

        <View style={styles.tabs}>
          {(['overview', 'farmers', 'crops', 'sales'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' ? (
          <>
            <View style={styles.metricRow}>
              <GlassCard style={styles.metric}>
                <Text style={styles.metricVal}>{stats.total}</Text>
                <Text style={styles.metricLbl}>TOTAL FARMERS</Text>
              </GlassCard>
              <GlassCard style={styles.metric}>
                <Text style={styles.metricVal}>{stats.active}</Text>
                <Text style={styles.metricLbl}>ACTIVE 30D</Text>
              </GlassCard>
            </View>
            <View style={styles.metricRow}>
              <GlassCard style={styles.metric}>
                <Text style={styles.metricVal}>{stats.scans}</Text>
                <Text style={styles.metricLbl}>TOTAL SCANS</Text>
              </GlassCard>
              <GlassCard style={styles.metric}>
                <Text style={styles.metricVal}>₦{(stats.revenue || 0).toLocaleString()}</Text>
                <Text style={styles.metricLbl}>REVENUE</Text>
              </GlassCard>
            </View>

            <Text style={styles.section}>TOP CROPS</Text>
            {crops.slice(0, 5).map(([name, count]: any) => (
              <View key={name} style={styles.cropRow}>
                <Text style={styles.cropName}>{name}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: Math.min(100, (count / (crops[0]?.[1] || 1)) * 100) + '%' }]} />
                </View>
                <Text style={styles.cropCount}>{count}</Text>
              </View>
            ))}
          </>
        ) : null}

        {tab === 'farmers' ? (
          <>
            <Text style={styles.section}>REGISTERED FARMERS ({farmers.length})</Text>
            {farmers.slice(0, 50).map((f, i) => (
              <GlassCard key={i} style={{ marginBottom: 8 }}>
                <Text style={styles.farmerName}>{f.first_name || 'Unknown'} {f.last_name || ''}</Text>
                <Text style={styles.farmerMeta}>{f.state_city || f.country || 'No location'} · {f.phone || 'No phone'}</Text>
              </GlassCard>
            ))}
          </>
        ) : null}

        {tab === 'crops' ? (
          <>
            <Text style={styles.section}>CROP DISTRIBUTION</Text>
            {crops.map(([name, count]: any) => (
              <GlassCard key={name} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.cropName}>{name}</Text>
                  <Text style={styles.cropCount}>{count} scans</Text>
                </View>
              </GlassCard>
            ))}
          </>
        ) : null}

        {tab === 'sales' ? (
          <>
            <Text style={styles.section}>EXPORT DATA</Text>
            <GlassCard>
              <Text style={styles.exportText}>
                Sell this data to:
                {'\n'}• Input suppliers (know which regions need what)
                {'\n'}• Insurance companies (risk assessment)
                {'\n'}• Off-takers (predict harvest volumes)
                {'\n'}• Government (food security planning)
              </Text>
              <NeonButton
                label="GENERATE DATA REPORT"
                onPress={() => {}}
                style={{ marginTop: 16 }}
              />
            </GlassCard>
          </>
        ) : null}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: 6 },
  blocked: { color: p.danger, textAlign: 'center', marginTop: 100, fontSize: 18, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 20 },
  tab: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabText: { fontSize: 10, fontWeight: '800', color: p.textMuted },
  tabTextActive: { color: p.obsidian },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metric: { flex: 1, alignItems: 'center', padding: 18 },
  metricVal: { fontSize: 26, fontWeight: '900', color: p.neon },
  metricLbl: { ...typography.micro, color: p.textMuted, marginTop: 4 },
  section: { ...typography.micro, color: p.textMuted, marginTop: 20, marginBottom: 12 },
  cropRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cropName: { fontSize: 13, fontWeight: '700', color: p.text, width: 100, textTransform: 'capitalize' },
  barBg: { flex: 1, height: 8, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon },
  cropCount: { fontSize: 12, fontWeight: '800', color: p.neon, width: 50, textAlign: 'right' },
  farmerName: { fontSize: 15, fontWeight: '800', color: p.text },
  farmerMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  exportText: { fontSize: 13, color: p.text, lineHeight: 22 },
});
