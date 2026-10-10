import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export default function Radio() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [segment, setSegment] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stationName] = useState(() => 'GAIA ' + ['FM', 'Radio', 'Live'][Math.floor(Math.random() * 3)]);
  const ticker = useRef<any>(null);

  const loadSegment = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const { data: s } = await supabase.rpc('season_get_active');
      const crop = s?.active ? s.season.crop : 'Maize';
      const stage = s?.active ? s.season.current_stage : 'vegetative';
      const dsp = s?.active ? s.days_since_planting : 30;
      const dth = s?.active ? s.days_to_harvest : 80;
      const events = s?.active ? (s.events || []).slice(0, 6).map((e: any) => ({ kind: e.kind, label: e.label })) : [];

      const r = await fetch(API_BASE + '/season/radio-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({
          crop, stage, days_since_planting: dsp, days_to_harvest: dth,
          state: null, language: 'en', recent_events: events,
          market_price_naira_per_kg: null, weather: null,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        setSegment(j);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSegment(); }, [loadSegment]);

  const play = () => {
    if (!segment) return;
    try {
      Speech.stop();
      setPlaying(true);
      Speech.speak(segment.full_text, {
        language: 'en-NG',
        pitch: 1.0,
        rate: 0.92,
        onDone: () => setPlaying(false),
        onStopped: () => setPlaying(false),
        onError: () => setPlaying(false),
      });
    } catch { setPlaying(false); }
  };

  const stop = () => {
    Speech.stop();
    setPlaying(false);
  };

  useEffect(() => {
    if (playing) {
      ticker.current = setInterval(() => {
        loadSegment();
      }, 1800000); // 30 min
    } else if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
    return () => {
      if (ticker.current) { clearInterval(ticker.current); ticker.current = null; }
      Speech.stop();
    };
  }, [playing, loadSegment]);

  const segs = segment?.segments || {};

  return (
    <LinearGradient colors={['#0a0f1a', '#0d1520', '#050810']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => { stop(); router.back(); }}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <View style={styles.stationRow}>
          <View style={styles.liveDot} />
          <Text style={styles.stationName}>{stationName}</Text>
          <Text style={styles.stationSub}>LIVE</Text>
        </View>

        <View style={styles.tuner}>
          <LinearGradient colors={['#ff3b5c', '#ff8f00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.artwork}>
            <Text style={styles.artworkEmoji}>📻</Text>
          </LinearGradient>

          <Text style={styles.nowPlaying}>{playing ? 'NOW PLAYING' : 'PRESS PLAY'}</Text>
          <Text style={styles.segmentTitle}>
            {segment ? 'GAIA Field Brief · ' + (segment.duration_estimate_sec || 45) + 's' : 'Loading…'}
          </Text>
        </View>

        {loading ? <ActivityIndicator color="#00ff88" style={{ marginTop: 24 }} /> : (
          <>
            <Pressable onPress={playing ? stop : play} style={[styles.playBtn, playing && styles.playBtnActive]}>
              <Text style={styles.playIcon}>{playing ? '■' : '▶'}</Text>
            </Pressable>

            {segments_list(segs, styles)}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

function segments_list(segs: any, styles: any) {
  const rows = [
    { key: 'weather', label: 'WEATHER', emoji: '🌤' },
    { key: 'action',  label: 'TODAY',   emoji: '✅' },
    { key: 'price',   label: 'PRICE',   emoji: '📈' },
    { key: 'tip',     label: 'TIP',     emoji: '💡' },
    { key: 'sign_off',label: 'GAIA',    emoji: '🌱' },
  ];
  return rows.map((r) => (
    <View key={r.key} style={styles.segRow}>
      <Text style={styles.segEmoji}>{r.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.segLabel}>{r.label}</Text>
        <Text style={styles.segText}>{segs[r.key] || '…'}</Text>
      </View>
    </View>
  ));
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b5c' },
  stationName: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  stationSub: { fontSize: 10, fontWeight: '900', color: '#ff3b5c', letterSpacing: 2 },
  tuner: { alignItems: 'center', marginBottom: 24 },
  artwork: { width: 180, height: 180, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  artworkEmoji: { fontSize: 72 },
  nowPlaying: { fontSize: 10, fontWeight: '900', letterSpacing: 2.4, color: 'rgba(255,255,255,0.5)' },
  segmentTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 6 },
  playBtn: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: '#00ff88', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  playBtnActive: { backgroundColor: '#ff3b5c' },
  playIcon: { fontSize: 32, color: '#000', fontWeight: '900' },
  segRow: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 8 },
  segEmoji: { fontSize: 24, marginTop: 2 },
  segLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8, color: '#00ff88', marginBottom: 4 },
  segText: { fontSize: 13, color: '#fff', lineHeight: 18 },
});
