import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Share, Dimensions, Image, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const { width, height } = Dimensions.get('window');

function fmtN(n: any) { return 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 }); }
function fmtDate(s?: string) { return s ? new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : ''; }

interface Slide {
  kind: 'intro' | 'event' | 'photo' | 'value' | 'reveal';
  title?: string;
  subtitle?: string;
  value?: string;
  image?: string;
  emoji?: string;
  color?: [string, string];
}

export default function SeasonReel() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [season, setSeason] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [idx, setIdx] = useState(0);

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    (async () => {
      if (!params.id) return;
      const { data: s } = await supabase.from('seasons').select('*').eq('id', params.id).single();
      const { data: ev } = await supabase.from('season_events').select('*')
        .eq('season_id', params.id).order('created_at', { ascending: true });
      setSeason(s);
      setEvents(ev || []);

      const built: Slide[] = [];
      const revenue = Number(s?.actual_revenue_naira || 0);
      const cost = Number(s?.total_cost_naira || 0);
      const profit = revenue - cost;
      const yieldKg = Number(s?.actual_yield_kg || 0);
      const ha = Number(s?.plot_hectares || 1);

      built.push({
        kind: 'intro',
        title: s?.crop + (s?.variety ? ' · ' + s.variety : ''),
        subtitle: fmtDate(s?.planting_date) + ' → ' + fmtDate(s?.actual_harvest_date),
        emoji: '🌱',
        color: ['#0a1f14', '#00c853'],
      });

      (ev || []).forEach((e: any, i: number) => {
        if (e.kind === 'planted') return;
        const emojiMap: Record<string, string> = {
          sprayed: '🧪', weeded: '🌿', fertilized: '💩', watered: '💧',
          rained: '🌧', disease: '🦠', pest: '🐛', note: '📝', harvest: '🌾',
        };
        built.push({
          kind: 'event',
          title: e.label || e.kind,
          subtitle: fmtDate(e.created_at) + (e.cost_naira > 0 ? ' · ' + fmtN(e.cost_naira) : ''),
          emoji: emojiMap[e.kind] || '•',
          color: ['#0a0f1a', '#26c6da'],
          image: e.image_url,
        });
      });

      built.push({
        kind: 'value',
        title: 'You invested',
        value: fmtN(cost),
        color: ['#1a0a0a', '#ff3b5c'],
        emoji: '💸',
      });

      built.push({
        kind: 'value',
        title: 'You harvested',
        value: (yieldKg / 1000).toFixed(2) + ' tonnes',
        color: ['#0a1a0f', '#00c853'],
        emoji: '🌾',
      });

      built.push({
        kind: 'value',
        title: 'You earned',
        value: fmtN(revenue),
        color: ['#0a1a0f', '#00ff88'],
        emoji: '💰',
      });

      built.push({
        kind: 'reveal',
        title: 'Your profit',
        value: fmtN(profit),
        subtitle: (yieldKg / ha).toFixed(0) + ' kg / hectare',
        color: profit >= 0 ? ['#000', '#00ff88'] : ['#000', '#ff3b5c'],
        emoji: profit >= 0 ? '🏆' : '📉',
      });

      setSlides(built);
    })();
  }, [params.id]);

  const play = (i: number) => {
    fade.setValue(0);
    scale.setValue(0.9);
    setIdx(i);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (slides.length > 0 && idx < slides.length) {
      play(idx);
      const t = setTimeout(() => {
        if (idx < slides.length - 1) setIdx(idx + 1);
      }, 3200);
      return () => clearTimeout(t);
    }
  }, [idx, slides.length]);

  const share = async () => {
    if (!season) return;
    const revenue = Number(season.actual_revenue_naira || 0);
    const cost = Number(season.total_cost_naira || 0);
    const profit = revenue - cost;
    const msg =
      `🌾 My ${season.crop} season on GAIA\n\n` +
      `Revenue: ${fmtN(revenue)}\n` +
      `Cost: ${fmtN(cost)}\n` +
      `Profit: ${fmtN(profit)}\n` +
      `Yield: ${Number(season.actual_yield_kg || 0).toLocaleString()} kg\n\n` +
      `Powered by Darkmoor AI.`;
    try { await Share.share({ message: msg }); } catch {}
  };

  if (slides.length === 0) return <View style={styles.container} />;

  const s = slides[Math.min(idx, slides.length - 1)];
  const progress = ((idx + 1) / slides.length) * 100;

  return (
    <View style={styles.container}>
      <LinearGradient colors={s.color || ['#000', '#111']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
        <View style={styles.progressRow}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.progressTick,
              { backgroundColor: i <= idx ? '#fff' : 'rgba(255,255,255,0.25)' }]} />
          ))}
        </View>

        <Animated.View style={[styles.center, { opacity: fade, transform: [{ scale }] }]}>
          {s.emoji ? <Text style={styles.bigEmoji}>{s.emoji}</Text> : null}
          {s.image ? <Image source={{ uri: s.image }} style={styles.slideImg} resizeMode="cover" /> : null}
          {s.title ? <Text style={[styles.title, s.kind === 'reveal' && styles.titleReveal]}>{s.title}</Text> : null}
          {s.value ? <Text style={[styles.value, s.kind === 'reveal' && styles.valueReveal]}>{s.value}</Text> : null}
          {s.subtitle ? <Text style={styles.subtitle}>{s.subtitle}</Text> : null}
        </Animated.View>

        <View style={styles.bottomBar}>
          <Pressable onPress={() => setIdx(Math.max(0, idx - 1))} style={styles.navBtn}>
            <Text style={styles.navTxt}>‹</Text>
          </Pressable>
          <Pressable onPress={() => idx < slides.length - 1 ? setIdx(idx + 1) : null} style={styles.navBtn}>
            <Text style={styles.navTxt}>›</Text>
          </Pressable>
        </View>

        {idx === slides.length - 1 ? (
          <Pressable onPress={share} style={styles.shareBtn}>
            <Text style={styles.shareTxt}>SHARE MY SEASON</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeTxt}>✕</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressRow: { flexDirection: 'row', gap: 4, paddingTop: 60, paddingHorizontal: 16 },
  progressTick: { flex: 1, height: 3, borderRadius: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  bigEmoji: { fontSize: 80, marginBottom: 24 },
  slideImg: { width: width * 0.75, height: width * 0.75, borderRadius: 24, marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.05)' },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 32 },
  titleReveal: { fontSize: 18, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  value: { fontSize: 44, fontWeight: '900', color: '#00ff88', letterSpacing: -1.5, marginTop: 12, textAlign: 'center' },
  valueReveal: { fontSize: 60, letterSpacing: -2.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 12, textAlign: 'center', fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 40, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24 },
  navBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  navTxt: { fontSize: 32, color: '#fff', fontWeight: '200', lineHeight: 34 },
  shareBtn: { position: 'absolute', left: 24, right: 24, bottom: 110, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  shareTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  closeBtn: { position: 'absolute', right: 20, top: 70, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 20, color: '#fff', fontWeight: '400' },
});
