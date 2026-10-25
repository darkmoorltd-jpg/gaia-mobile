import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from '../api/supabase';
import { useLocale } from './locale';
import { signInWithGoogle as googleFlow } from '../utils/googleAuth';
import type { User, Session } from '@supabase/supabase-js';

const LOGIN_CONTEXT_KEY = 'gaia_login_context';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  scansRemaining: number;
  plan: string;
  role: 'farmer' | 'agent' | 'admin' | null;
  loginContext: 'agent' | 'user' | null;
  isNewUser: boolean;

  setUser: (u: User | null) => void;
  setAuth: (u: User | null, s: Session | null) => void;
  setScans: (n: number, plan: string) => void;
  refreshScans: () => Promise<void>;
  refreshRole: () => Promise<void>;
  loadLoginContext: () => Promise<void>;
  setLoginContext: (c: 'agent' | 'user' | null) => Promise<void>;

  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, countryCode?: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  signInAsAgent: (email: string, agentCode: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

async function logLogin(userId: string, email: string | undefined) {
  try {
    await supabase.from('login_history').insert({
      user_id: userId, email: email ?? null, platform: Platform.OS,
    });
  } catch {}
}

async function checkBan(userId: string): Promise<string | null> {
 try {
    const { data: prof } = await supabase
      .from('user_profiles')
      .select('banned_until, banned_reason')
      .eq('user_id', userId)
      .maybeSingle();
    if (prof?.banned_until && new Date(prof.banned_until) > new Date()) {
      await supabase.auth.signOut();
      const until = new Date(prof.banned_until).toLocaleString();
      return 'Your account is suspended until ' + until + '. ' + (prof.banned_reason || '');
    }
  } catch {}
  return null;
}

async function fetchRole(userId: string): Promise<'farmer' | 'agent' | 'admin' | null> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.role === 'agent') return 'agent';
    if (data?.role === 'admin') return 'admin';
    return 'farmer';
  } catch { return null; }
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  scansRemaining: 30,
  plan: 'free',
  role: null,
  loginContext: null,
  isNewUser: false,

  setUser: (u) => set({ user: u, loading: false }),
  setAuth: (u, s) => set({ user: u, session: s, loading: false }),
  setScans: (n, plan) => set({ scansRemaining: n, plan }),

  refreshScans: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_scans')
        .select('scans_remaining, plan')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) set({ scansRemaining: data.scans_remaining, plan: data.plan });
    } catch (e) { console.log('refreshScans failed', e); }
  },

  refreshRole: async () => {
    const user = get().user;
    if (!user) return;
    const r = await fetchRole(user.id);
    if (r) set({ role: r });
  },

  loadLoginContext: async () => {
    try {
      const ctx = await AsyncStorage.getItem(LOGIN_CONTEXT_KEY);
      if (ctx === 'agent' || ctx === 'user') {
        set({ loginContext: ctx });
      }
    } catch {}
  },

  setLoginContext: async (c) => {
    // Synchronous state update FIRST so router effect sees the right value
    set({ loginContext: c });
    try {
      if (c) await AsyncStorage.setItem(LOGIN_CONTEXT_KEY, c);
      else await AsyncStorage.removeItem(LOGIN_CONTEXT_KEY);
    } catch {}
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;

      // Check ban BEFORE flipping state
      const ban = await checkBan(data.user.id);
      if (ban) return ban;

      // Set context + state
      await get().setLoginContext('user');
      set({ user: data.user, session: data.session, loading: false, role: null });
      try { await get().refreshScans(); } catch {}
      try { await get().refreshRole(); } catch {}
      try { await logLogin(data.user.id, data.user.email); } catch {}
      return null;
    } catch (e: any) {
      return e?.message ?? 'Sign in failed';
    }
  },

  signUp: async (email, password, countryCode?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return error.message;
      if (!data.user) return 'Signup failed';

      // Resolve country name + code from locale
      const locale = useLocale.getState();
      const code = (countryCode || locale.country?.code || 'NG').toUpperCase();
      let countryName = locale.country?.name || code;
      if (code === 'NG') countryName = 'Nigeria';

      // Try to resolve proper name from countries table
      try {
        const { data: c } = await supabase
          .from('countries')
          .select('name')
          .eq('code', code)
          .maybeSingle();
        if (c?.name) countryName = c.name;
      } catch {}

      try {
        await supabase.from('user_scans').insert({
          user_id: data.user.id, scans_remaining: 30, plan: 'free',
        });
      } catch {}

      await get().setLoginContext('user');

      try {
        await supabase.from('user_profiles').upsert(
          {
            user_id: data.user.id,
            email: (data.user.email || email).toLowerCase(),
            country: countryName,
            country_code: code,
            verification_status: 'pending',
            account_status: 'active',
          },
          { onConflict: 'user_id' }
        );
      } catch (e) { console.warn('[signup] profile upsert failed', e); }

      set({ user: data.user, session: data.session, loading: false, role: 'farmer' });
      await get().refreshScans();
      return null;
    } catch (e: any) { return e?.message ?? 'Sign up failed'; }
  },

  signInWithGoogle: async () => {
    try {
      const res = await googleFlow();
      if (res.cancelled) return null;
      if (res.error) return res.error;
      const got = await supabase.auth.getSession();
      const session = got.data.session;
      if (!session || !session.user) return 'Google sign-in did not return a session';
      const ban = await checkBan(session.user.id);
      if (ban) return ban;

      // Resolve country from locale store
      const locale = useLocale.getState();
      const code = (locale.country?.code || 'NG').toUpperCase();
      const countryName = locale.country?.name || code;

      let isNew = false;
      try {
        const check = await supabase
          .from('user_profiles')
          .select('user_id,country_code')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!check.data) {
          // New Google user — create profile
          isNew = true;
          await supabase.from('user_profiles').insert({
            user_id: session.user.id,
            email: (session.user.email || '').toLowerCase(),
            country: countryName,
            country_code: code,
            verification_status: 'pending',
            account_status: 'active',
            role: 'farmer',
          });
          try {
            await supabase.from('user_scans').insert({
              user_id: session.user.id,
              scans_remaining: 30,
              plan: 'free',
            });
          } catch {}
        } else if (!check.data.country_code) {
          // Existing profile but missing country_code — backfill
          await supabase.from('user_profiles').update({
            country_code: code,
            country: countryName,
          }).eq('user_id', session.user.id);
        }
      } catch (e) { console.log('[google] profile:', e); }

      await get().setLoginContext('user');
      set({ user: session.user, session, loading: false, role: 'farmer', isNewUser: isNew });
      await Promise.all([get().refreshScans(), get().refreshRole()]);
      await logLogin(session.user.id, session.user.email);
      return null;
    } catch (e: any) { return e?.message ?? 'Google sign-in failed'; }
  },

  resetPassword: async (email) => {
    try {
      const redirectTo = Linking.createURL('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return error?.message ?? null;
    } catch (e: any) { return e?.message ?? 'Reset failed'; }
  },

  updatePassword: async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return error?.message ?? null;
    } catch (e: any) { return e?.message ?? 'Update failed'; }
  },

  signInAsAgent: async (email, agentCode, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;

      const status = await supabase.rpc('agent_check_my_status');
      const statusData: any = status.data || {};
      const agentRow = statusData.agent;
      const appRow = statusData.application;

      if (!agentRow) {
        if (appRow) {
          if (appRow.status === 'rejected') return 'Agent application rejected. Log in as normal user.';
          if (appRow.payment_status !== 'paid') return 'Agent application awaiting N3,000 payment.';
          return 'Agent application pending admin approval. Log in as normal user.';
        }
        return 'This account is not an agent account.';
      }
      if (agentRow.status === 'suspended') return 'Agent account suspended.';
      if (agentRow.status !== 'active') return 'Agent account not active yet.';
      if (!agentRow.agent_code || agentRow.agent_code.toLowerCase() !== agentCode.trim().toLowerCase()) {
        return 'Agent code does not match.';
      }

      const ban = await checkBan(data.user.id);
      if (ban) return ban;

      // SUCCESS — set everything cleanly, do NOT navigate
      await get().setLoginContext('agent');
      set({ user: data.user, session: data.session, loading: false, role: 'agent' });
      try { await get().refreshScans(); } catch {}
      try { await get().refreshRole(); } catch {}
      try { await logLogin(data.user.id, data.user.email); } catch {}
      return null;
    } catch (e: any) {
      return e?.message ?? 'Agent sign in failed';
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log('[signOut] supabase signOut failed:', e);
    }
    try {
      await AsyncStorage.removeItem(LOGIN_CONTEXT_KEY);
    } catch (e) {}
    set({
      user: null,
      session: null,
      scansRemaining: 0,
      plan: 'free',
      role: null,
      loginContext: null,
      isNewUser: false,
    });
  },
}));
