import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme, typography, spacing, radius } from '../theme';
import { fetchWeather, minutesUntilRain, bestSprayDays, WeatherBundle } from '../utils/weather';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WeatherWidget() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [w, setW] = useState<WeatherBundle | null>(null);
  const [busy, setBusy] = useState(true);
  
  // The new expanded state
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetchWeather();
      setW(r);
      setBusy(false);
    })();
  }, []);

  const toggleExpand = () => {
    if (!w) {
      // If weather failed to load, tapping should retry
      setBusy(true);
      (async () => {
        const r = await fetchWeather();
        setW(r);
        setBusy(false);
      })();
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const now = w?.hourly?.[0];
  const rainMin = w ? minutesUntilRain(w) : null;
  const spray = w ? bestSprayDays(w, 3) : [];

  if (busy) {
    return (
      <View style={styles.collapsedCard}>
        <ActivityIndicator color={palette.neon} style={{ marginRight: 14 }} />
        <Text style={styles.collapsedSub}>Fetching local weather...</Text>
      </View>
    );
  }

  // ============================================================
  // REVOLUTIONARY COLLAPSED STATE
  // ============================================================
  if (!isExpanded) {
    return (
      <Pressable onPress={toggleExpand} style={styles.collapsedCard}>
        <View style={styles.collapsedIconWrap}>
          <Text style={styles.collapsedIcon}>{!w ? '⚠️' : rainMin != null ? '☔' : '☀️'}</Text>
        </View>
        <View style={styles.collapsedTextWrap}>
          {!w ? (
            <Text style={styles.collapsedTitle}>Weather unavailable</Text>
          ) : (
            <>
              <Text style={styles.collapsedTitle}>{Math.round(now?.temp ?? 0)}°C</Text>
              <Text style={styles.collapsedSub}>
                {rainMin != null 
                  ? `Rain in ~${rainMin < 60 ? `${rainMin}m` : `${Math.round(rainMin/60)}h`}` 
                  : 'Dry next 24h'}
              </Text>
            </>
          )}
        </View>
        <View style={styles.collapsedChevronWrap}>
          <Text style={styles.collapsedChevron}>{!w ? '↻' : '›'}</Text>
        </View>
      </Pressable>
    );
  }

  // ============================================================
  // EXPANDED STATE
  // ============================================================
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>TODAY</Text>
        <Pressable onPress={toggleExpand} style={styles.minimizeBtn} hitSlop={15}>
          <Text style={styles.minimizeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.temp}>{Math.round(now?.temp ?? 0)}°C</Text>
          <Text style={styles.muted}>
            {Math.round(now?.humidity ?? 0)}% RH · {Math.round(now?.wind_kmh ?? 0)} km/h wind
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          {rainMin != null ? (
            <View style={styles.rainPill}>
              <Text style={styles.rainText}>
                ☔ Rain in ~{rainMin < 60 ? `${rainMin}m` : `${Math.round(rainMin/60)}h`}
              </Text>
            </View>
          ) : (
            <View style={[styles.rainPill, styles.dryPill]}>
              <Text style={[styles.rainText, { color: palette.neon }]}>☀️ Dry next 24h</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.kicker, { marginTop: 18 }]}>BEST SPRAY DAYS</Text>
      <View style={styles.sprayRow}>
        {spray.length === 0 ? (
          <Text style={styles.muted}>No good spray days in the next 7 days</Text>
        ) : (
          spray.map((d) => {
            const dt = new Date(d.date);
            const day = dt.toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <View key={d.date} style={styles.sprayDay}>
                <Text style={styles.sprayDayLabel}>{day}</Text>
                <Text style={styles.sprayDayScore}>{d.spray_score}</Text>
              </View>
            );
          })
        )}
      </View>
      <Text style={styles.hint}>Score ≥ 70 means low wind, no rain, good temp.</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  // --- Collapsed State ---
  collapsedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: p.surface,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.25)', // Subtle blue tint for weather
    shadowColor: '#4fc3f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  collapsedIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(79,195,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  collapsedIcon: { fontSize: 24 },
  collapsedTextWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  collapsedTitle: { fontSize: 20, fontWeight: '900', color: p.text },
  collapsedSub: { fontSize: 12, color: '#4fc3f7', fontWeight: '700' },
  collapsedChevronWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  collapsedChevron: { fontSize: 22, color: '#4fc3f7', fontWeight: '400', lineHeight: 24 },

  // --- Expanded State ---
  card: {
    backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: p.border, marginBottom: spacing.md,
    shadowColor: '#4fc3f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  minimizeBtn: { padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  minimizeText: { fontSize: 14, fontWeight: '800', color: p.textMuted },
  
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginBottom: 4 },
  temp: { fontSize: 40, fontWeight: '900', color: p.text, letterSpacing: -1 },
  muted: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  rainPill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(79,195,247,0.15)', borderWidth: 1, borderColor: '#4fc3f7',
  },
  dryPill: { backgroundColor: 'rgba(0,255,136,0.10)', borderColor: p.neon },
  rainText: { fontSize: 12, fontWeight: '800', color: '#4fc3f7' },
  sprayRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  sprayDay: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(0,255,136,0.10)', borderWidth: 1, borderColor: p.neon,
    alignItems: 'center', minWidth: 60,
  },
  sprayDayLabel: { fontSize: 10, fontWeight: '800', color: p.neon, letterSpacing: 1 },
  sprayDayScore: { fontSize: 18, fontWeight: '900', color: p.text, marginTop: 2 },
  hint: { fontSize: 10, color: p.textDim, marginTop: 8, fontStyle: 'italic' },
});
