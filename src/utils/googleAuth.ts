import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../api/supabase';

export const AUTH_CALLBACK_PATH = 'auth-callback';
export const RESET_CALLBACK_PATH = 'reset-password';

export function getRedirectUrl(path: string): string {
  return Linking.createURL(path);
}

export interface OAuthResult {
  error: string | null;
  cancelled?: boolean;
}

export async function signInWithGoogle(): Promise<OAuthResult> {
  try {
    const redirectTo = getRedirectUrl(AUTH_CALLBACK_PATH);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });

    if (error) return { error: error.message };
    if (!data?.url) return { error: 'No OAuth URL returned' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { error: null, cancelled: true };
    }
    if (result.type !== 'success' || !result.url) {
      return { error: 'Google sign-in was not completed' };
    }

    const code = extractQueryParam(result.url, 'code');
    if (!code) return { error: 'Missing OAuth code' };

    const { data: sessionData, error: exchangeErr } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeErr) return { error: exchangeErr.message };
    if (!sessionData?.session) return { error: 'Session exchange failed' };

    return { error: null };
  } catch (e: any) {
    return { error: e?.message || 'Google sign-in failed' };
  }
}

export function extractQueryParam(url: string, key: string): string | null {
  try {
    const qIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    const sliceStart = qIndex >= 0 ? qIndex + 1 : (hashIndex >= 0 ? hashIndex + 1 : -1);
    if (sliceStart < 0) return null;
    const sliceEnd = qIndex >= 0 && hashIndex > qIndex ? hashIndex : url.length;
    const qs = url.slice(sliceStart, sliceEnd);
    for (const part of qs.split('&')) {
      const [k, v] = part.split('=');
      if (k === key) return decodeURIComponent(v || '');
    }
  } catch {}
  return null;
}

export function extractHashParam(url: string, key: string): string | null {
  try {
    const hashIndex = url.indexOf('#');
    if (hashIndex < 0) return null;
    const qs = url.slice(hashIndex + 1);
    for (const part of qs.split('&')) {
      const [k, v] = part.split('=');
      if (k === key) return decodeURIComponent(v || '');
    }
  } catch {}
  return null;
}
