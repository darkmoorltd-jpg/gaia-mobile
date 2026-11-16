import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../api/supabase';

export function usePushRegistration(user: any) {
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default', importance: Notifications.AndroidImportance.MAX,
          });
        }
        if (!Device.isDevice) return;
        const { status } = await Notifications.getPermissionsAsync();
        let granted = status === 'granted';
        if (!granted) {
          const r = await Notifications.requestPermissionsAsync();
          granted = r.status === 'granted';
        }
        if (!granted) return;
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        await supabase.from('push_tokens').upsert({ user_id: user.id, token }, { onConflict: 'user_id' });
      } catch {}
    })();
  }, [user]);
}
