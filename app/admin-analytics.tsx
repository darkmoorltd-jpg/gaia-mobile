import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import axios from 'axios';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const API = 'https://gaia-api-xuly.onrender.com';

export default function AdminAnalytics() {
  const router = useRouter();
  const { palette } = useTheme();
  const auth: any = useAuth();
  const user = auth.user;
  const session = auth.session;
  const styles = createStyles(palette);

  const [stats, setStats] = useState<any | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return;
    if (!session?.access_token) { setBusy(false); return; }
    setBusy(true);
    setErr('');
    try {
      const r = await axios.get(API + '/admin/stats', {
        headers: { Authorization: 'Bearer ' + session.access_token },
        timeout: 30000,
      });
      setStats(r.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || 'error');
    } finally { setBusy(false); }
  }, [user, session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const s = stats || {};

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.sub}>Live platform metrics</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <View style={styles.grid}>
          <Metric label="TOTAL USERS" value={s.total_users ?? '—'} palette={palette} />
          <Metric label="ONLINE NOW" value={s.online_now ?? '—'} palette={palette} accent={palette.neon} />
          <Metric label="DAU" value={s.dau ?? '—'} palette={palette} />
          <Metric label="WAU" value={s.wau ?? '—'} palette={palette} />
          <Metric label="MAU" value={s.mau ?? '—'} palette={palette} />
          <Metric label="SCANS TODAY" value={s.scans_24h ?? '—'} palette={palette} />
          <Metric label="TOTAL SCANS" value={s.scans_total ?? '—'} palette={palette} />
          <Metric label="PAYMENTS" value={s.payments_count ?? '—'} palette={palette} />
          <Metric label="REVENUE 30D" value={'N' + (s.revenue_30d || 0).toLocaleString()} palette={palette} accent={palette.warning} />
          <Metric label="REVENUE TOTAL" value={'N' + (s.revenue_total || 0).toLocaleString()} palette={palette} accent={palette.warning} />
        </View>

        {s.top_crops?.length ? (
          <>
            <Text style={styles.sectionLabel}>TOP CROPS SCANNED</Text>
            {s.top_crops.map(([k, v]: any) => (
              <View key={k} style={styles.barRow}>
                <Text style={styles.barLabel}>{k}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: Math.min(100, v * 4) + '%' }]} />
                </View>
                <Text style={styles.barVal}>{v}</Text>
              </View>
            ))}
          </>
        ) : null}

        {s.top_states?.length ? (
          <>
            <Text style={styles.sectionLabel}>TOP STATES</Text>
            {s.top_states.map(([k, v]: any) => (
              <View key={k} style={styles.barRow}>
                <Text style={styles.barLabel}>{k}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: Math.min(100, v * 4) + '%' }]} />
                </View>
                <Text style={styles.barVal}>{v}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, palette, accent }: any) {
  return (
    <View style={{
      width: '48%', padding: 18, borderRadius: 16,
      backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
      alignItems: 'center',
    }}>
      <Text style={{
        fontSize: 22, fontWeight: '900',
        color: accent || palette.neon,
      }}>{value}</Text>
      <Text style={{
        fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
        color: palette.textMuted, marginTop: 6, textAlign: 'center',
      }}>{label}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  err: { color: p.danger, fontSize: 12, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    color: p.textMuted, marginTop: 24, marginBottom: 10,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 90, fontSize: 11, color: p.text },
  barBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 4 },
  barVal: { width: 40, fontSize: 11, color: p.text, textAlign: 'right' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
