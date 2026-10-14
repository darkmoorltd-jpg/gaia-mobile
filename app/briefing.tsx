import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export default function Briefing() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [script, setScript] = useState<string>('');
  const [voiceReady, setVoiceReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [weather, setWeather] = useState<any>(null);

  const fetchWeather = async (lat: number, lon: number) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,relative_humidity_2m_max` +
      `&timezone=auto&forecast_days=3`;
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {}
    return null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get user profile
      let crops = 'maize';
      let state = 'Kaduna';
      let lat = 10.5105;
      let lon = 7.4165;

      if (user?.id) {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('primary_crops,state,farm_gps_lat,farm_gps_lon')
          .eq('user_id', user.id)
          .maybeSingle();
        if (prof) {
          if (prof.primary_crops) crops = prof.primary_crops;
          if (prof.state) state = prof.state;
          if (prof.farm_gps_lat) lat = prof.farm_gps_lat;
          if (prof.farm_gps_lon) lon = prof.farm_gps_lon;
        }
      }

      // 2. Try GPS override
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const loc = await Location.getLastKnownPositionAsync();
          if (loc) {
            lat = loc.coords.latitude;
            lon = loc.coords.longitude;
          }
        }
      } catch {}

      // 3. Weather
      const w = await fetchWeather(lat, lon);
      setWeather(w);

      // 4. Build weather summary for the prompt
      let wSummary = 'Weather data unavailable.';
      if (w?.daily?.time?.length) {
        const days = w.daily.time.slice(0, 3).map((d: string, i: number) =>
          `${d}: ${w.daily.temperature_2m_min[i]}-${w.daily.temperature_2m_max[i]}°C, rain ${w.daily.precipitation_sum[i]}mm, humidity ${w.daily.relative_humidity_2m_max[i]}%`
        );
        wSummary = days.join('\n');
      }

      // 5. Get Groq to write a spoken 60-sec brief
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });
      const prompt = `Write a 60-second voice briefing for a Nigerian farmer today (${today}) in ${state} with ${crops}.

Weather for the next 3 days:
${wSummary}

The briefing will be read ALOUD. Rules:
- Speak DIRECTLY to the farmer like a radio host who knows their farm.
- Open with "Good morning, farmer" (or "Good afternoon" / "Good evening" based on time of day).
- 3 short sections: WEATHER, TODAY'S FARM TASK, ONE THING TO WATCH.
- Be specific — mention actual temperatures, rainfall probabilities.
- Give ONE concrete action for today (spray, weed, dry, harvest, apply fertilizer).
- Mention ONE risk to watch (pest, disease, water stress, market).
- End with a one-line motivation.
- Nigerian context, friendly, no fluff, no section headers — just natural speech.
- Total: 150-200 words. No markdown. No asterisks. Read-aloud smooth.`;

      const r = await fetch(`${API_BASE}/agronomist/text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, history: [] }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setScript((data.answer || '').replace(/[#*_`>]/g, '').trim());
      setVoiceReady(true);
    } catch (e: any) {
      Alert.alert('Could not load briefing', e.message || 'Try again');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const play = async () => {
    if (!script) return;
    Speech.stop();
    setPlaying(true);
    Speech.speak(script, {
      language: 'en-NG',
      pitch: 1.0,
      rate: 0.95,
      onDone: () => setPlaying(false),
      onStopped: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };

  const stop = () => {
    Speech.stop();
    setPlaying(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>TODAY'S FARM</Text>
        <Text style={styles.title}>{greeting}, farmer</Text>
        <Text style={styles.sub}>
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={palette.neon} size="large" />
            <Text style={styles.loadingText}>Preparing your briefing...</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={playing ? stop : play}
              style={[styles.playBtn, playing && styles.playBtnOn]}
            >
              <Text style={styles.playIcon}>{playing ? '⏸' : '▶'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.playTitle}>
                  {playing ? 'PLAYING BRIEFING' : 'PLAY 60-SECOND BRIEFING'}
                </Text>
                <Text style={styles.playSub}>
                  {playing ? 'Tap to stop' : 'Tap to listen'}
                </Text>
              </View>
            </Pressable>

            {weather?.daily?.time?.length ? (
              <View style={styles.weatherRow}>
                {weather.daily.time.slice(0, 3).map((d: string, i: number) => (
                  <View key={d} style={styles.weatherCard}>
                    <Text style={styles.weatherDay}>
                      {i === 0 ? 'TODAY' : i === 1 ? 'TOMORROW' : 'DAY 3'}
                    </Text>
                    <Text style={styles.weatherTemp}>
                      {Math.round(weather.daily.temperature_2m_max[i])}°
                    </Text>
                    <Text style={styles.weatherMin}>
                      {Math.round(weather.daily.temperature_2m_min[i])}°
                    </Text>
                    <Text style={styles.weatherRain}>
                      {weather.daily.precipitation_sum[i]}mm
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {script ? (
              <View style={styles.scriptCard}>
                <Text style={styles.scriptHead}>TRANSCRIPT</Text>
                <Text style={styles.scriptBody}>{script}</Text>
              </View>
            ) : null}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 13, color: p.textMuted, marginTop: 8 },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 20, borderRadius: 20,
    backgroundColor: p.neon, marginBottom: 16,
  },
  playBtnOn: { backgroundColor: '#ffb300' },
  playIcon: { fontSize: 32, color: p.obsidian, fontWeight: '900' },
  playTitle: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  playSub: { fontSize: 11, color: 'rgba(0,0,0,0.65)', marginTop: 2, fontWeight: '600' },
  weatherRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  weatherCard: {
    flex: 1, padding: 14, borderRadius: 14,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center',
  },
  weatherDay: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: p.neon, marginBottom: 6 },
  weatherTemp: { fontSize: 22, fontWeight: '900', color: p.text },
  weatherMin: { fontSize: 12, color: p.textMuted, marginTop: -2 },
  weatherRain: { fontSize: 10, color: '#4fc3f7', marginTop: 6, fontWeight: '700' },
  scriptCard: {
    padding: 18, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  scriptHead: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon, marginBottom: 10 },
  scriptBody: { fontSize: 14, color: p.text, lineHeight: 24 },
});
