import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme, spacing, typography, radius } from '../src/theme';
import { Pill, GlassCard, NeonButton } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

export default function Affiliate() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [code, setCode] = useState('');
  const [stats, setStats] = useState({ clicks: 0, signups: 0, earnings: 0, pending: 0 });
  const [payouts, setPayouts] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!user) return;
    const c = 'GAIA-' + user.id.slice(0, 8).toUpperCase();
    setCode(c);

    const { data: clicks } = await supabase.from('affiliate_clicks').select('*').eq('affiliate_id', user.id);
    const { data: conversions } = await supabase.from('affiliate_conversions').select('*').eq('affiliate_id', user.id);
    const { data: myPayouts } = await supabase.from('affiliate_payouts').select('*').eq('affiliate_id', user.id).order('created_at', { ascending: false });

    const totalEarnings = (conversions || []).reduce((s, c) => s + (c.commission || 0), 0);
    const pendingEarnings = (conversions || []).filter((c) => c.status === 'pending').reduce((s, c) => s + (c.commission || 0), 0);

    setStats({
      clicks: clicks?.length || 0,
      signups: conversions?.length || 0,
      earnings: totalEarnings / 100,
      pending: pendingEarnings / 100,
    });
    setPayouts(myPayouts || []);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Share this code');
  };

  const share = async () => {
    await Share.share({
      message:
        'Make money with GAIA 🌱\n\n' +
        'Share your code: ' + code + '\n' +
        'You earn ₦200 for every farmer who subscribes.\n' +
        'No signup fee. Just share and earn.\n\n' +
        'Join: https://gaiagpt.streamlit.app',
    });
  };

  const requestPayout = async () => {
    if (!user || stats.earnings < 5000) {
      Alert.alert('Minimum ₦5,000', 'You need at least ₦5,000 in confirmed earnings');
      return;
    }
    const { error } = await supabase.from('affiliate_payouts').insert({
      affiliate_id: user.id,
      amount: stats.earnings * 100,
      status: 'requested',
    });
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Requested', 'Payout will be processed within 7 days');
      load();
    }
  };

  const commissionRate = 200; // ₦200 per paid signup

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Earn Money" color={palette.warning} />
        <Text style={styles.title}>Affiliate Program</Text>
        <Text style={styles.subtitle}>Earn ₦{commissionRate} for every farmer who subscribes</Text>

        <GlassCard style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={styles.codeLbl}>YOUR AFFILIATE CODE</Text>
          <Text style={styles.code}>{code}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <NeonButton label="COPY" variant="ghost" onPress={copy} />
            <NeonButton label="SHARE" onPress={share} />
          </View>
        </GlassCard>

        <View style={styles.metricsRow}>
          <GlassCard style={styles.metric}>
            <Text style={styles.metricVal}>{stats.clicks}</Text>
            <Text style={styles.metricLbl}>CLICKS</Text>
          </GlassCard>
          <GlassCard style={styles.metric}>
            <Text style={styles.metricVal}>{stats.signups}</Text>
            <Text style={styles.metricLbl}>SIGNUPS</Text>
          </GlassCard>
        </View>

        <View style={styles.metricsRow}>
          <GlassCard style={styles.metric}>
            <Text style={[styles.metricVal, { color: palette.neon }]}>₦{stats.earnings.toLocaleString()}</Text>
            <Text style={styles.metricLbl}>CONFIRMED</Text>
          </GlassCard>
          <GlassCard style={styles.metric}>
            <Text style={[styles.metricVal, { color: palette.warning }]}>₦{stats.pending.toLocaleString()}</Text>
            <Text style={styles.metricLbl}>PENDING</Text>
          </GlassCard>
        </View>

        <NeonButton label="REQUEST PAYOUT" onPress={requestPayout} style={{ marginTop: 16 }} />

        <Text style={styles.section}>PAYOUT HISTORY</Text>
        {payouts.length === 0 ? (
          <GlassCard><Text style={styles.empty}>No payouts yet</Text></GlassCard>
        ) : payouts.map((p) => (
          <GlassCard key={p.id} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.payoutAmount}>₦{(p.amount / 100).toLocaleString()}</Text>
              <Text style={[styles.payoutStatus, p.status === 'paid' && { color: palette.neon }]}>{p.status}</Text>
            </View>
            <Text style={styles.payoutDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
          </GlassCard>
        ))}

        <Text style={styles.section}>HOW IT WORKS</Text>
        <GlassCard>
          <Text style={styles.how}>
            1. Share your code with farmers{'\n'}
            2. When they subscribe to GAIA premium, you earn ₦200{'\n'}
            3. Payouts every 7 days (minimum ₦5,000){'\n'}
            4. Track everything in real-time
          </Text>
        </GlassCard>
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
  codeLbl: { ...typography.micro, color: p.textMuted },
  code: { fontSize: 26, fontWeight: '900', color: p.warning, letterSpacing: 3, marginTop: 8 },
  metricsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metric: { flex: 1, alignItems: 'center', padding: 16 },
  metricVal: { fontSize: 22, fontWeight: '900', color: p.text },
  metricLbl: { ...typography.micro, color: p.textMuted, marginTop: 4 },
  section: { ...typography.micro, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  empty: { color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  payoutAmount: { fontSize: 16, fontWeight: '900', color: p.text },
  payoutStatus: { fontSize: 11, fontWeight: '800', color: p.warning, textTransform: 'uppercase' },
  payoutDate: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  how: { fontSize: 13, color: p.text, lineHeight: 22 },
});
