import * as Location from 'expo-location';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

export interface HourlyForecast {
  time: string;
  temp: number;
  rain_prob: number;       // 0-100
  rain_mm: number;
  wind_kmh: number;
  humidity: number;
}

export interface DailyForecast {
  date: string;
  t_max: number;
  t_min: number;
  rain_mm: number;
  rain_prob: number;
  wind_max_kmh: number;
  spray_score: number;      // 0-100, higher = better spray day
  good_spray: boolean;
}

export interface WeatherBundle {
  lat: number;
  lon: number;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  fetched_at: number;
}

async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const last = await Location.getLastKnownPositionAsync();
  if (last) return { lat: last.coords.latitude, lon: last.coords.longitude };
  const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: cur.coords.latitude, lon: cur.coords.longitude };
}

/**
 * Compute a "spray score" 0-100.
 * Conditions for a good spray day:
 *   - low wind (< 10 km/h avg)
 *   - no rain that day (< 1 mm and < 30% chance)
 *   - moderate temp (15-32 C)
 *   - humidity 40-80%
 */
function sprayScore(d: {
  t_max: number; rain_mm: number; rain_prob: number; wind_max_kmh: number;
}): { score: number; good: boolean } {
  let score = 100;
  // wind penalty
  if (d.wind_max_kmh > 20) score -= 60;
  else if (d.wind_max_kmh > 12) score -= 30;
  else if (d.wind_max_kmh > 8) score -= 10;
  // rain penalty
  if (d.rain_mm > 5) score -= 60;
  else if (d.rain_mm > 1) score -= 30;
  else if (d.rain_prob > 60) score -= 20;
  else if (d.rain_prob > 30) score -= 8;
  // temp penalty
  if (d.t_max > 35 || d.t_max < 10) score -= 30;
  else if (d.t_max > 32 || d.t_max < 15) score -= 10;
  score = Math.max(0, Math.min(100, score));
  return { score, good: score >= 70 };
}

export async function fetchWeather(force = false): Promise<WeatherBundle | null> {
  const coords = await getCoords();
  if (!coords) return null;

  // check cache (1 hour)
  try {
    const cached = globalThis as any;
    const c = cached.__gaia_weather_cache;
    if (!force && c && Date.now() - c.fetched_at < 60 * 60 * 1000) {
      return c as WeatherBundle;
    }
  } catch {}

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    forecast_days: '7',
    timezone: 'auto',
  });

  try {
    const r = await fetch(`${OPEN_METEO}?${params.toString()}`, { timeout: 15000 } as any);
    if (!r.ok) return null;
    const d = await r.json();

    const hourly: HourlyForecast[] = (d.hourly?.time || []).map((t: string, i: number) => ({
      time: t,
      temp: d.hourly.temperature_2m[i],
      rain_prob: d.hourly.precipitation_probability[i],
      rain_mm: d.hourly.precipitation[i],
      wind_kmh: d.hourly.wind_speed_10m[i],
      humidity: d.hourly.relative_humidity_2m[i],
    }));

    const daily: DailyForecast[] = (d.daily?.time || []).map((t: string, i: number) => {
      const t_max = d.daily.temperature_2m_max[i];
      const t_min = d.daily.temperature_2m_min[i];
      const rain_mm = d.daily.precipitation_sum[i];
      const rain_prob = d.daily.precipitation_probability_max[i];
      const wind_max_kmh = d.daily.wind_speed_10m_max[i];
      const { score, good } = sprayScore({ t_max, rain_mm, rain_prob, wind_max_kmh });
      return { date: t, t_max, t_min, rain_mm, rain_prob, wind_max_kmh, spray_score: score, good_spray: good };
    });

    const bundle: WeatherBundle = { lat: coords.lat, lon: coords.lon, hourly, daily, fetched_at: Date.now() };
    (globalThis as any).__gaia_weather_cache = bundle;
    return bundle;
  } catch {
    return null;
  }
}

/** Returns minutes until next rain event within the next 24h, or null. */
export function minutesUntilRain(w: WeatherBundle): number | null {
  const now = Date.now();
  for (const h of w.hourly) {
    const t = new Date(h.time).getTime();
    if (t < now) continue;
    if (t > now + 24 * 60 * 60 * 1000) break;
    if (h.rain_mm > 0.2 || h.rain_prob > 60) {
      return Math.round((t - now) / 60000);
    }
  }
  return null;
}

/** Returns the next N good spray days. */
export function bestSprayDays(w: WeatherBundle, n = 3): DailyForecast[] {
  return w.daily.filter((d) => d.good_spray).slice(0, n);
}
