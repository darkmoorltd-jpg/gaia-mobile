import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { usePresenceHeartbeat } from '../src/utils/presence';
import { ThemeProvider, useTheme } from '../src/theme';

const queryClient = new QueryClient();

function InnerApp() {
  const { user, setAuth, loading } = useAuth();
  usePresenceHeartbeat(user?.id);
  const { mode } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session?.user ?? null, data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuth(session?.user ?? null, session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    else if (user && inAuth) router.replace('/(tabs)');
  }, [user, loading, segments]);

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <InnerApp />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
