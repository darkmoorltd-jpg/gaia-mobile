import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { useSettings } from '../src/store/settings';
import { syncPendingFarms } from '../src/utils/farmSync';
import NetInfo from '@react-native-community/netinfo';
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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') useSettings.getState().load().catch(() => {});
    });
    return () => sub.remove();
  }, []);

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
    const PUBLIC_ROUTES = ['agent-apply', 'auth-callback', 'reset-password', 'index'];
    const isPublic = PUBLIC_ROUTES.includes(seg0) || seg0 === '';

    if (!user && !inAuth && !isPublic) {
      router.replace('/(auth)/login' as any);
      return;
    }
    
    if (user && inAuth) {
      const effContext = loginContext || (role === 'agent' ? 'agent' : 'user');
      const dest = effContext === 'agent' ? '/agent/home' : '/(tabs)';
      const timer = setTimeout(() => {
        try { router.replace(dest as any); } catch {}
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [user, ready, loading, segments, loginContext, role]);

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
      <Stack.Screen name="boa-portal" options={{ headerShown: false }} />
      <Stack.Screen name="soil-data" options={{ headerShown: false }} />
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
