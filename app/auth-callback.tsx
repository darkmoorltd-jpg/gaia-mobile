import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';

function parseParamsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!url) return out;
  const qIndex = url.indexOf('?');
  const hIndex = url.indexOf('#');
  const qEnd = hIndex > qIndex && qIndex >= 0 ? hIndex : url.length;
  if (qIndex >= 0) {
    for (const part of url.slice(qIndex + 1, qEnd).split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      out[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
    }
  }
  if (hIndex >= 0) {
    for (const part of url.slice(hIndex + 1).split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      out[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
    }
  }
  return out;
}

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const setAuth = useAuth((s) => s.setAuth);
  const refreshScans = useAuth((s) => s.refreshScans);
  const refreshRole = useAuth((s) => s.refreshRole);
  const [msg, setMsg] = useState('Finishing sign-in...');

  useEffect(() => {
    (async () => {
      try {
        // Combine router params + raw deep link URL params
        const fromRouter: Record<string, string> = {};
        for (const [k, v] of Object.entries(params)) {
          if (typeof v === 'string') fromRouter[k] = v;
        }
        const initialUrl = await Linking.getInitialURL();
        const fromUrl = initialUrl ? parseParamsFromUrl(initialUrl) : {};
        const all = { ...fromUrl, ...fromRouter };

        if (all.error) {
          setMsg('Sign-in failed: ' + (all.error_description || all.error));
          setTimeout(() => router.replace('/(auth)/login'), 2500);
          return;
        }

        const type = all.type || '';

        // Path 1 — PKCE code
        if (all.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(all.code);
          if (error) {
            setMsg('Could not complete sign-in: ' + error.message);
            setTimeout(() => router.replace('/(auth)/login'), 3000);
            return;
          }
          if (data.session && data.user) {
            setAuth(data.user, data.session);
            await Promise.all([refreshScans(), refreshRole()]);
            router.replace(type === 'recovery' ? '/reset-password' : '/(tabs)');
            return;
          }
        }

        // Path 2 — Implicit tokens in hash
        if (all.access_token && all.refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token: all.access_token,
            refresh_token: all.refresh_token,
          });
          if (error) {
            setMsg('Could not complete sign-in: ' + error.message);
            setTimeout(() => router.replace('/(auth)/login'), 3000);
            return;
          }
          if (data.session && data.user) {
            setAuth(data.user, data.session);
            await Promise.all([refreshScans(), refreshRole()]);
            router.replace(type === 'recovery' ? '/reset-password' : '/(tabs)');
            return;
          }
        }

        // Path 3 — token_hash (email magic link / password recovery)
        if (all.token_hash && all.type) {
          const { data, error } = await supabase.auth.verifyOtp({
            type: all.type as any,
            token_hash: all.token_hash,
          });
          if (error) {
            setMsg('Link could not be verified: ' + error.message);
            setTimeout(() => router.replace('/(auth)/login'), 3000);
            return;
          }
          if (data.session && data.user) {
            setAuth(data.user, data.session);
            await Promise.all([refreshScans(), refreshRole()]);
            router.replace(all.type === 'recovery' ? '/reset-password' : '/(tabs)');
            return;
          }
        }

        setMsg('No sign-in parameters found.');
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
