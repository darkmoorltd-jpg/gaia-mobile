import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });
const fmtT = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M t';
  if (x >= 1e3) return (x / 1e3).toFixed(1) + 'K t';
  return x.toFixed(1) + ' t';
};

export default function MinistryBriefing() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [data, setData] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [n, h, f, p, c] = await Promise.all([
      supabase.rpc('ministry_national_summary', { p_days: 7 }),
      supabase.rpc('ministry_harvest_forecast', { p_crop: null }),
      supabase.rpc('ministry_food_security_index', {}),
      supabase.rpc('ministry_program_delivery', {}),
      supabase.rpc('ministry_cooperative_network', {}),
    ]);
    setData({
      national: n.data || {},
      harvest: h.data || {},
      food: f.data || {},
      delivery: p.data || {},
      coops: c.data || {},
    });
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const today = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  const nat = data.national || {};
  const ds = nat.disease_signal || {};
  const hf = data.harvest || {};
  const fs = data.food || {};
  const del = data.delivery || {};
  const co = data.coops || {};

  const totalTonnes = Number(hf.total_tonnes || 0);
  const peopleFed = totalTonnes > 0 ? Math.round((totalTonnes * 1000) / 146) : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <View style={styles.paper}>
          <Text style={styles.paperKicker}>FEDERAL MINISTRY OF AGRICULTURE</Text>
          <Text style={styles.paperTitle}>Executive Briefing</Text>
          <Text style={styles.paperDate}>{today} · Powered by GAIA</Text>

          <View style={styles.divider} />

          <Text style={styles.h}>1. FOOD SECURITY STATUS</Text>
          <View style={styles.line}>
            <Text style={styles.l}>National score</Text>
            <Text style={[styles.v, { color: Number(fs.national_score) >= 70 ? '#00ff88' : Number(fs.national_score) >= 40 ? '#ffb300' : '#ff3b5c' }]}>
              {Number(fs.national_score || 0).toFixed(1)} / 100
            </Text>
          </View>
          <View style={styles.line}><Text style={styles.l}>At-risk states</Text><Text style={styles.v}>{num(fs.at_risk_states)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Strong states</Text><Text style={styles.v}>{num(fs.strong_states)}</Text></View>

          <Text style={styles.h}>2. HARVEST FORECAST</Text>
          <View style={styles.line}><Text style={styles.l}>Forecast production</Text><Text style={styles.v}>{fmtT(totalTonnes)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Hectares under production</Text><Text style={styles.v}>{num(hf.total_hectares, 1)} ha</Text></View>
          <View style={styles.line}>
            <Text style={styles.l}>Feeds for one year</Text>
            <Text style={[styles.v, { color: '#00ff88' }]}>{num(peopleFed)} people</Text>
          </View>

          <Text style={styles.h}>3. DISEASE SITUATION</Text>
          <View style={styles.line}><Text style={styles.l}>This week's signal</Text><Text style={styles.v}>{num(ds.this_week)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Prior week</Text><Text style={styles.v}>{num(ds.prior_week)}</Text></View>
          <View style={styles.line}>
            <Text style={styles.l}>Change</Text>
            <Text style={[styles.v, { color: (ds.this_week || 0) - (ds.prior_week || 0) > 0 ? '#ff3b5c' : '#00ff88' }]}>
              {(ds.this_week || 0) - (ds.prior_week || 0) >= 0 ? '+' : ''}{num((ds.this_week || 0) - (ds.prior_week || 0))}
            </Text>
          </View>

          <Text style={styles.h}>4. PROGRAM DELIVERY</Text>
          <View style={styles.line}><Text style={styles.l}>Total allocated</Text><Text style={styles.v}>N{num(del.total_allocated)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Farmers in programs</Text><Text style={styles.v}>{num(del.total_farmers)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Verified active</Text><Text style={styles.v}>{num(del.total_verified)}</Text></View>

          <Text style={styles.h}>5. COOPERATIVE NETWORK</Text>
          <View style={styles.line}><Text style={styles.l}>Groups registered</Text><Text style={styles.v}>{num(co.total_coops)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Total members</Text><Text style={styles.v}>{num(co.total_members)}</Text></View>

          <View style={styles.divider} />

          <Text style={styles.signOff}>Prepared by GAIA · Federal Ministry of Agriculture</Text>
          <Text style={styles.signOff2}>Screenshot for briefing</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  paper: { padding: 24, borderRadius: 20, backgroundColor: '#0d1410', borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)' },
  paperKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 3, color: '#00ff88', textAlign: 'center' },
  paperTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 6, letterSpacing: -0.5 },
  paperDate: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 6 },
  divider: { height: 1, backgroundColor: 'rgba(0,255,136,0.2)', marginVertical: 20 },
  h: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: '#00ff88', marginTop: 16, marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  l: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  v: { fontSize: 13, fontWeight: '800', color: '#fff' },
  signOff: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: 1 },
  signOff2: { fontSize: 9, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
