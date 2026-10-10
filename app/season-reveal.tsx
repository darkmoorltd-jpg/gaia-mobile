import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Share, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const { width } = Dimensions.get('window');

function fmtN(n: any) { return 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 }); }

export default function SeasonReveal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [season, setSeason] = useState<any>(null);
  const [liveValue, setLiveValue] = useState(0);
  const [profit, setProfit] = useState(0);

  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedProfit = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    (async () => {
      if (!params.id) return;
      const { data } = await supabase.from('seasons').select('*').eq('id', params.id).single();
      if (data) {
        setSeason(data);
        const rev = Number(data.actual_revenue_naira || 0);
        const cost = Number(data.total_cost_naira || 0);
        setLiveValue(rev);
        setProfit(rev - cost);

        // animate
        Animated.parallel([
          Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        ]).start();

        Animated.timing(animatedValue, {
          toValue: rev, duration: 1800, delay: 400, useNativeDriver: false,
        }).start();

        Animated.timing(animatedProfit, {
          toValue: rev - cost, duration: 1800, delay: 800, useNativeDriver: false,
        }).start();

        // subscribe to value changes for display
        animatedValue.addListener(({ value }) => setLiveValue(Math.round(value)));
        animatedProfit.addListener(({ value }) => setProfit(Math.round(value)));
      }
    })();
    return () => {
      animatedValue.removeAllListeners();
      animatedProfit.removeAllListeners();
    };
  }, [params.id]);

  const share = async () => {
    if (!season) return;
    const msg =
      `I just finished a ${season.crop} season on GAIA.\n` +
      `Revenue: ${fmtN(season.actual_revenue_naira)}\n` +
      `Profit: ${fmtN(Number(season.actual_revenue_naira || 0) - Number(season.total_cost_naira || 0))}\n` +
      `Powered by Darkmoor AI.`;
    try { await Share.share({ message: msg }); } catch {}
  };

  if (!season) return <View style={styles.container} />;

  const profitColor = profit >= 0 ? '#00ff88' : '#ff3b5c';
  const yieldKg = Number(season.actual_yield_kg || 0);
  const ha = Number(season.plot_hectares || 1);

  return (
    <LinearGradient colors={['#000000', '#0a1f14', '#000000']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.container}>
      <Animated.View style={[styles.center, { opacity: fadeIn, transform: [{ scale }] }]}>
        <Text style={styles.kicker}>SEASON COMPLETE</Text>
        <Text style={styles.crop}>{season.crop}{season.variety ? ' · ' + season.variety : ''}</Text>

        <View style={styles.bigBox}>
          <Text style={styles.bigLabel}>TOTAL REVENUE</Text>
          <Text style={styles.bigValue}>{fmtN(liveValue)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.bigBox}>
          <Text style={styles.bigLabel}>YOUR PROFIT</Text>
          <Text style={[styles.bigValue, { color: profitColor }]}>{fmtN(profit)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{(yieldKg / 1000).toFixed(2)}t</Text>
            <Text style={styles.statLbl}>YIELD</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{(yieldKg / ha).toFixed(0)}</Text>
            <Text style={styles.statLbl}>KG / HA</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{fmtN(season.total_cost_naira)}</Text>
            <Text style={styles.statLbl}>COST</Text>
          </View>
        </View>

        <Pressable onPress={share} style={styles.shareBtn}>
          <Text style={styles.shareTxt}>SHARE MY SEASON</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/season' as any)} style={styles.doneBtn}>
          <Text style={styles.doneTxt}>START NEXT SEASON</Text>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', width: '100%' },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3, color: 'rgba(0,255,136,0.75)' },
  crop: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 8, letterSpacing: -0.5 },
  bigBox: { alignItems: 'center', marginTop: 32, width: '100%' },
  bigLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2.4, color: 'rgba(255,255,255,0.5)' },
  bigValue: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -2.5, marginTop: 6 },
  divider: { width: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 28 },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 36, width: '100%' },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  shareBtn: { marginTop: 48, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', width: '100%', alignItems: 'center' },
  shareTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.4 },
  doneBtn: { marginTop: 12, padding: 18, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', width: '100%', alignItems: 'center' },
  doneTxt: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1.4 },
});
