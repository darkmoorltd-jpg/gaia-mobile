import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme, spacing, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const CHALLENGES = [
  { id: 'c1', title: 'Scan 10 leaves this week', reward: 20, target: 10, type: 'scans' },
  { id: 'c2', title: 'Log in 7 days in a row', reward: 15, target: 7, type: 'streak' },
  { id: 'c3', title: 'Share 3 scans on WhatsApp', reward: 10, target: 3, type: 'shares' },
  { id: 'c4', title: 'Refer 1 friend who signs up', reward: 30, target: 1, type: 'referrals' },
];

export default function Referral() {
  const { palette } = useTheme();
  const { user, refreshScans } = useAuth();
  const styles = createStyles(palette);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [progress, setProgress] = useState<any>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!user) return;
    const code = 'GAIA-' + user.id.slice(0, 8).toUpperCase();
    setReferralCode(code);

    const { data: refs } = await supabase.from('referrals').select('*').eq('referrer_id', user.id);
    setReferralCount(refs?.length || 0);

    const { data: streakData } = await supabase.from('user_streaks').select('*').eq('user_id', user.id).single();
    setStreak(streakData?.current_streak || 0);

    const { data: challenges } = await supabase.from('user_challenges').select('*').eq('user_id', user.id);
    const map: any = {};
    (challenges || []).forEach((c) => { map[c.challenge_id] = c.progress || 0; });
    setProgress(map);
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert('Copied!', 'Share this code with a friend');
  };

  const shareCode = async () => {
    await Share.share({
      message: 'Join GAIA — the AI agronomist for African farmers. Use my code ' + referralCode + ' to get 10 free bonus scans! Download: https://gaiagpt.streamlit.app',
    });
  };

  const claimChallenge = async (ch: any) => {
    if (!user) return;
    const current = progress[ch.id] || 0;
    if (current < ch.target) {
      Alert.alert('Not yet', 'Progress: ' + current + '/' + ch.target);
      return;
    }
    if (current === -1) {
      Alert.alert('Already claimed');
      return;
    }
    await supabase.from('user_challenges').upsert({ user_id: user.id, challenge_id: ch.id, progress: -1, claimed_at: new Date().toISOString() });
    await supabase.rpc('add_scans', { uid: user.id, amount: ch.reward });
    await refreshScans();
    Alert.alert('Claimed!', 'You earned +' + ch.reward + ' scans');
    load();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Earn Scans" />
        <Text style={styles.title}>Rewards</Text>

        {/* Referral card */}
        <GlassCard style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={styles.cardLbl}>YOUR REFERRAL CODE</Text>
          <Text style={styles.code}>{referralCode}</Text>
          <Text style={styles.sub}>You and your friend both get +10 scans</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <NeonButton label="COPY" variant="ghost" onPress={copyCode} />
            <NeonButton label="SHARE" onPress={shareCode} />
          </View>
          <Text style={styles.count}>{referralCount} friends joined</Text>
        </GlassCard>

        {/* Streak card */}
        <GlassCard style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={styles.cardLbl}>DAILY STREAK</Text>
          <Text style={styles.streakNum}>{streak} 🔥</Text>
          <Text style={styles.sub}>Log in 7 days in a row for +15 scans</Text>
        </GlassCard>

        {/* Challenges */}
        <Text style={styles.section}>CHALLENGES</Text>
        {CHALLENGES.map((ch) => {
          const cur = progress[ch.id] || 0;
          const claimed = cur === -1;
          const pct = Math.min(100, (Math.max(0, cur) / ch.target) * 100);
          return (
            <GlassCard key={ch.id} style={{ marginBottom: 10 }}>
              <View style={styles.chRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chTitle}>{ch.title}</Text>
                  <Text style={styles.chReward}>+{ch.reward} scans</Text>
                </View>
                {claimed ? (
                  <Text style={styles.claimed}>CLAIMED</Text>
                ) : (
                  <NeonButton label="CLAIM" variant={cur >= ch.target ? 'primary' : 'ghost'} onPress={() => claimChallenge(ch)} />
                )}
              </View>
              {!claimed ? (
                <>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: pct + '%' }]} />
                  </View>
                  <Text style={styles.progress}>{Math.max(0, cur)}/{ch.target}</Text>
                </>
              ) : null}
            </GlassCard>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  cardLbl: { ...typography.micro, color: p.textMuted },
  code: { fontSize: 26, fontWeight: '900', color: p.neon, letterSpacing: 3, marginTop: 8 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 6, textAlign: 'center' },
  count: { fontSize: 11, color: p.textDim, marginTop: 14 },
  streakNum: { fontSize: 48, fontWeight: '900', color: p.warning, marginTop: 8 },
  section: { ...typography.micro, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chTitle: { fontSize: 14, fontWeight: '700', color: p.text },
  chReward: { fontSize: 12, color: p.neon, marginTop: 4 },
  claimed: { fontSize: 11, fontWeight: '900', color: p.neon },
  barBg: { height: 6, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon },
  progress: { fontSize: 10, color: p.textMuted, marginTop: 4 },
});
