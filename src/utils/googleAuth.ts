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

/** Parse a URL's query string OR hash fragment into a plain object. */
function parseParamsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!url) return out;

  // Query string
  const qIndex = url.indexOf('?');
  const hIndex = url.indexOf('#');
  const qEnd = hIndex > qIndex && qIndex >= 0 ? hIndex : url.length;
  if (qIndex >= 0) {
    const qs = url.slice(qIndex + 1, qEnd);
    for (const part of qs.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = decodeURIComponent(part.slice(0, eq));
      const v = decodeURIComponent(part.slice(eq + 1));
      out[k] = v;
    }
  }

  // Hash fragment
  if (hIndex >= 0) {
    const hs = url.slice(hIndex + 1);
    for (const part of hs.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = decodeURIComponent(part.slice(0, eq));
      const v = decodeURIComponent(part.slice(eq + 1));
      out[k] = v;
    }
  }

  return out;
}

/**
 * Full Google sign-in flow.
 * 1. Ask Supabase for the Google auth URL.
 * 2. Open it in a native browser sheet.
 * 3. Parse the returned URL for either `?code=` (PKCE) or `#access_token=...` (implicit).
 * 4. Complete the session either way.
 */
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

    const params = parseParamsFromUrl(result.url);

    // Error returned by Supabase
    if (params.error) {
      return { error: params.error_description || params.error };
    }

    // Path 1: PKCE flow — Supabase sends ?code=...
    if (params.code) {
      const { data: sessionData, error: exchangeErr } =
        await supabase.auth.exchangeCodeForSession(params.code);
      if (exchangeErr) return { error: exchangeErr.message };
      if (!sessionData?.session) return { error: 'Session exchange failed' };
      return { error: null };
    }

    // Path 2: Implicit flow — Supabase sends #access_token=...&refresh_token=...
    if (params.access_token && params.refresh_token) {
      const { data: sess, error: setErr } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (setErr) return { error: setErr.message };
      if (!sess?.session) return { error: 'Failed to establish session' };
      return { error: null };
    }

    // Path 3: Supabase sent back a token_hash (email OTP style)
    if (params.token_hash && params.type) {
      const { data: v, error: vErr } = await supabase.auth.verifyOtp({
        type: params.type as any,
        token_hash: params.token_hash,
      });
      if (vErr) return { error: vErr.message };
      if (!v?.session) return { error: 'Verification failed' };
      return { error: null };
    }

    return { error: 'Google sign-in returned no session parameters' };
  } catch (e: any) {
    return { error: e?.message || 'Google sign-in failed' };
  }
}

export function extractQueryParam(url: string, key: string): string | null {
  return parseParamsFromUrl(url)[key] ?? null;
}

export function extractHashParam(url: string, key: string): string | null {
  return parseParamsFromUrl(url)[key] ?? null;
}
