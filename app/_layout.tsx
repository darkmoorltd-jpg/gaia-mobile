import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { useSettings } from '../src/store/settings';
import { registerPushToken } from '../src/utils/push';
import { useLocation } from '../src/store/location';
import { palette } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    useLocation.getState().start();
  }, []);


  const user = useAuth((s: any) => s.user);
  const role = useAuth((s: any) => s.role);
  const refreshRole = useAuth((s: any) => s.refreshRole);
  const loginContext = useAuth((s: any) => s.loginContext);
  const loadLoginContext = useAuth((s: any) => s.loadLoginContext);
  const setUser = useAuth((s: any) => s.setUser);
  const loading = useAuth((s: any) => s.loading);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        try { await useSettings.getState().load(); } catch {}

        const { data } = await supabase.auth.getSession();
        if (mounted) {
          if (setUser) setUser(data.session?.user ?? null);
          if (data.session?.user) {
            try { await loadLoginContext(); } catch {}
            try { await refreshRole(); } catch {}
          }
          setReady(true);
        }
      } catch (e) {
        console.log('session bootstrap failed', e);
        if (mounted) setReady(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (setUser) setUser(s?.user ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Refresh config when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') useSettings.getState().load().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Poll remote config every 60s so admin toggles apply without app restart
  useEffect(() => {
    const id = setInterval(() => {
      useSettings.getState().load().catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    const seg0 = String(segments[0] || '');
    const inAuth = seg0 === '(auth)';
    const PUBLIC = ['agent-apply', 'auth-callback', 'reset-password'];
    const isPublic = PUBLIC.includes(seg0);

    // Rule 1: not logged in → back to login
    if (!user && !inAuth && !isPublic) {
      router.replace('/(auth)/login' as any);
      return;
    }

    // Rule 2: logged in AND sitting on login screen → go home (by context)
    if (user && inAuth) {
      const dest = (loginContext === 'agent') ? '/agent/home' : '/(tabs)';
      const t = setTimeout(() => {
        try { router.replace(dest as any); } catch {}
      }, 250);
      return () => clearTimeout(t);
    }

    // Any other screen handles its own navigation
  }, [user, ready, loading, segments, loginContext]);

  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const u = await Updates.checkForUpdateAsync();
        if (u.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) { console.log('OTA check failed', e); }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={palette.neon} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.obsidian } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="voice" />
      <Stack.Screen name="rag" />
      <Stack.Screen name="marketplace-sell" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen name="admin-agents" options={{ headerShown: false }} />
      <Stack.Screen name="admin-advanced-search" options={{ headerShown: false }} />
      <Stack.Screen name="agent-apply" options={{ headerShown: false }} />
      <Stack.Screen name="agent" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="farm-mapping" />
      <Stack.Screen name="farm-detail" />
      <Stack.Screen name="farms" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <RootNavigator />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: palette.obsidian, alignItems: 'center', justifyContent: 'center' },
});
