import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; type?: string; error?: string; error_description?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const setAuth = useAuth((s) => s.setAuth);
  const refreshScans = useAuth((s) => s.refreshScans);
  const refreshRole = useAuth((s) => s.refreshRole);
  const [msg, setMsg] = useState('Finishing sign-in...');

  useEffect(() => {
    (async () => {
      try {
        if (params.error) {
          setMsg('Sign-in failed: ' + (params.error_description || params.error));
          setTimeout(() => router.replace('/(auth)/login'), 2500);
          return;
        }
        const code = typeof params.code === 'string' ? params.code : null;
        const type = typeof params.type === 'string' ? params.type : '';
        if (!code) {
          setMsg('Missing authentication code.');
          setTimeout(() => router.replace('/(auth)/login'), 2500);
          return;
        }
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg('Could not complete sign-in: ' + error.message);
          setTimeout(() => router.replace('/(auth)/login'), 3000);
          return;
        }
        if (data.session && data.user) {
          setAuth(data.user, data.session);
          await Promise.all([refreshScans(), refreshRole()]);
          if (type === 'recovery' || type === 'passwordRecovery') {
            router.replace('/reset-password');
            return;
          }
          router.replace('/(tabs)');
          return;
        }
        setMsg('Session exchange returned nothing.');
        setTimeout(() => router.replace('/(auth)/login'), 2500);
      } catch (e: any) {
        setMsg('Unexpected error: ' + (e?.message || 'unknown'));
        setTimeout(() => router.replace('/(auth)/login'), 2500);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={palette.neon} size="large" />
      <Text style={styles.msg}>{msg}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 20 },
});
