import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { useSettings } from '../src/store/settings';
import { useLocale } from '../src/store/locale';
import { initI18n, loadLanguage } from '../src/utils/i18n';
import { bumpStreak } from '../src/utils/streak';
import { registerPushToken } from '../src/utils/push';
import { registerPushToken as registerExpoToken, subscribeToNotifications, triggerOutbreakScan } from '../src/utils/notifications';
import { useLocation } from '../src/store/location';
import { palette } from '../src/theme';
import { installTapHandler, registerForPush } from '../src/utils/pushNotifications';
import GaiaSplash from '../src/components/GaiaSplash';

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
  const [minSplashDone, setMinSplashDone] = useState(false);
  const localeLoaded = useLocale((s) => s.loaded);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        try { await useSettings.getState().load(); } catch {}
        try { await useLocale.getState().load(); } catch {}
        try { await initI18n(useLocale.getState().language); } catch {}

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

  // Fire streak bump once per session when user is ready
  const streakBumpedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    if (streakBumpedRef.current === user.id) return;
    streakBumpedRef.current = user.id;
    bumpStreak().catch(() => {});
  }, [user?.id]);

  // Enforce a minimum splash duration so it feels intentional, not flickery
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  const currentLang = useLocale((s) => s.language);
  useEffect(() => {
    loadLanguage(currentLang).catch(() => {});
  }, [currentLang]);

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

  // Install notification tap handler once
  useEffect(() => {
    const cleanup = installTapHandler();
    return cleanup;
  }, []);

  // (Re)register push token when user changes
  useEffect(() => {
    if (user?.id) registerForPush(user.id).catch(() => {});
  }, [user?.id]);



  // Notifications: register device token + live subscribe to alerts
  useEffect(() => {
    if (!user?.id) return;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        await registerExpoToken(user.id);
        triggerOutbreakScan().catch(() => {});
        unsub = subscribeToNotifications(user.id, (notif) => {
          console.log('[notif]', notif.title, '-', notif.body);
        });
      } catch (e) {
        console.warn('[notifications] setup failed', e);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [user?.id]);

  if (!ready || !minSplashDone) {
    return <GaiaSplash />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.obsidian } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="voice" />
      <Stack.Screen name="rag" />
      <Stack.Screen name="marketplace-sell" options={{ presentation: 'modal' }} />
      <Stack.Screen name="escrow-chat" options={{ headerShown: false }} />
      <Stack.Screen name="escrow-receipt" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen name="admin-agents" options={{ headerShown: false }} />
      <Stack.Screen name="admin-advanced-search" options={{ headerShown: false }} />
      <Stack.Screen name="agent-apply" options={{ headerShown: false }} />
      <Stack.Screen name="agent-leaderboard" options={{ headerShown: false }} />
      <Stack.Screen name="agent-field-map" options={{ headerShown: false }} />
      <Stack.Screen name="agent" options={{ headerShown: false }} />
      <Stack.Screen name="photo-timeline" options={{ headerShown: false }} />
      <Stack.Screen name="alerts" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="farm-mapping" />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="video-scan" options={{ headerShown: false }} />
      <Stack.Screen name="farm-detail" />
      <Stack.Screen name="farms" />
      <Stack.Screen name="aflatoxin" options={{ headerShown: false }} />
      <Stack.Screen name="land-estimator" options={{ headerShown: false }} />
      <Stack.Screen name="briefing" options={{ headerShown: false }} />
      <Stack.Screen name="loans" options={{ headerShown: false }} />
      <Stack.Screen name="loans-apply" options={{ headerShown: false }} />
      <Stack.Screen name="loan-receipt" options={{ headerShown: false }} />
      <Stack.Screen name="admin-loans-mobile" options={{ headerShown: false }} />
      <Stack.Screen name="loan-detail" options={{ headerShown: false }} />
      <Stack.Screen name="video-history-map" options={{ headerShown: false }} />
      <Stack.Screen name="video-growth" options={{ headerShown: false }} />
      <Stack.Screen name="video-session-report" options={{ headerShown: false }} />
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
