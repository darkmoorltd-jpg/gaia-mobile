import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTheme, typography, spacing, radius } from '../theme';
import { fetchWeather, minutesUntilRain, bestSprayDays, WeatherBundle } from '../utils/weather';

export default function WeatherWidget() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [w, setW] = useState<WeatherBundle | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetchWeather();
      setW(r);
      setBusy(false);
    })();
  }, []);

  if (busy) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }
  if (!w) {
    return (
      <Pressable onPress={() => setBusy(true)} style={styles.card}>
        <Text style={styles.muted}>Weather unavailable — tap to retry</Text>
      </Pressable>
    );
  }

  const now = w.hourly[0];
  const rainMin = minutesUntilRain(w);
  const spray = bestSprayDays(w, 3);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>TODAY</Text>
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
  card: {
    backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: p.border, marginBottom: spacing.md,
  },
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
