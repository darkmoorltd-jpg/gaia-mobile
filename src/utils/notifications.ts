import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../api/supabase';

// Show notifications while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const { status: asked } = await Notifications.requestPermissionsAsync();
      status = asked;
    }
    if (status !== 'granted') return null;

    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;
    if (!token) return null;

    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        device_model: Device.modelName || 'unknown',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
    return token;
  } catch (e) {
    console.warn('[notifications] register failed', e);
    return null;
  }
}

// Subscribe to realtime inserts on notification_queue for this user.
// Returns an unsubscribe function.
export function subscribeToNotifications(
  userId: string,
  onNotification: (payload: { title: string; body: string; data?: any }) => void,
): () => void {
  const channel = supabase
    .channel('nq-' + userId + '-' + Date.now())
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_queue',
        filter: 'user_id=eq.' + userId,
      },
      (payload: any) => {
        const row = payload.new || {};
        if (!row.title) return;
        // Fire a local notification immediately
        try {
          Notifications.scheduleNotificationAsync({
            content: {
              title: row.title,
              body: row.body || '',
              data: row.data || {},
              sound: true,
            },
            trigger: null,
          });
        } catch (e) {
          console.warn('[notifications] local schedule failed', e);
        }
        onNotification({
          title: row.title,
          body: row.body || '',
          data: row.data || {},
        });
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// Fetch unread notifications for inbox
export async function fetchUnreadNotifications(userId: string) {
  try {
    const { data } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  } catch {
    return [];
  }
}

// Mark one notification read
export async function markNotificationRead(notificationId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notification_queue')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    return !error;
  } catch {
    return false;
  }
}

// Trigger server-side outbreak scan (call from admin or once per app boot)
export async function triggerOutbreakScan(): Promise<number> {
  try {
    const { data } = await supabase.rpc('dispatch_outbreak_alerts');
    return typeof data === 'number' ? data : 0;
  } catch (e) {
    console.warn('[notifications] dispatch failed', e);
    return 0;
  }
}
