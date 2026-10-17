import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../api/supabase';

// ---- Global handler: show banner while app is in foreground ----
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }) as any,
});

// ---- Register for push + save token ----
export async function registerForPush(userId: string) {
  if (!userId) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00ff88',
      });
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Weather & disease alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#ff9800',
      });
    }

    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return null;
    if (Device.isDevice === false) return null;

    const tok = (await Notifications.getExpoPushTokenAsync()).data;
    if (!tok) return null;

    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token: tok,
        platform: Platform.OS,
        device_model: Device.modelName || 'unknown',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
    return tok;
  } catch (e) {
    console.warn('[push] register failed', e);
    return null;
  }
}

// ---- Read quiet hours from profile ----
export async function getQuietHours(): Promise<{ enabled: boolean; start: number; end: number }> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { enabled: true, start: 21, end: 6 };
    const { data } = await supabase
      .from('user_profiles')
      .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
      .eq('user_id', uid)
      .maybeSingle();
    return {
      enabled: data?.quiet_hours_enabled ?? true,
      start: data?.quiet_hours_start ?? 21,
      end: data?.quiet_hours_end ?? 6,
    };
  } catch {
    return { enabled: true, start: 21, end: 6 };
  }
}

export function isQuietHour(startHour: number, endHour: number): boolean {
  const h = new Date().getHours();
  if (startHour < endHour) return h >= startHour && h < endHour;
  // overnight (e.g. 21 -> 6)
  return h >= startHour || h < endHour;
}

// ---- Schedule a local "rain alarm" notification ----
export async function scheduleRainAlarm(
  minutesUntilRain: number,
  description: string,
): Promise<string | null> {
  try {
    const qh = await getQuietHours();
    // fire 60 min before the rain — or immediately if it's <60 min away
    const fireInMin = Math.max(0, minutesUntilRain - 60);
    const fireAt = new Date(Date.now() + fireInMin * 60 * 1000);

    if (qh.enabled) {
      const hr = fireAt.getHours();
      // if it would fire in quiet hours, skip (user said "don't ping me")
      const quiet = qh.start < qh.end
        ? hr >= qh.start && hr < qh.end
        : hr >= qh.start || hr < qh.end;
      if (quiet) {
        console.log('[rain] suppressed by quiet hours');
        return null;
      }
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rain incoming',
        body: description,
        data: { screen: '/(tabs)/index', type: 'rain' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, fireInMin * 60),
        repeats: false,
      } as any,
    });
    return id;
  } catch (e) {
    console.warn('[rain] schedule failed', e);
    return null;
  }
}

// ---- Tap handler: deep-link when user taps the notification ----
export function installTapHandler() {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const data: any = response.notification.request.content.data || {};
      const screen = data.screen || data.route;
      if (screen && typeof screen === 'string') {
        router.push(screen as any);
      }
    } catch (e) {
      console.warn('[push] tap handler error', e);
    }
  });
  return () => sub.remove();
}

// ---- Send a local notification (used by weather + digest screens) ----
export async function sendLocalNotification(
  title: string,
  body: string,
  data: Record<string, any> = {},
  channelId = 'default',
): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelAll() {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
}
