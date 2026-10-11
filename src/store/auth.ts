import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../api/supabase';
import { signInWithGoogle as googleFlow } from '../utils/googleAuth';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  scansRemaining: number;
  plan: string;
  role: 'farmer' | 'agent' | 'admin' | null;
  isNewUser: boolean;

  setUser: (u: User | null) => void;
  setAuth: (u: User | null, s: Session | null) => void;
  setScans: (n: number, plan: string) => void;
  refreshScans: () => Promise<void>;
  refreshRole: () => Promise<void>;

  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  signInAsAgent: (email: string, agentCode: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

async function logLogin(userId: string, email: string | undefined) {
  try {
    await supabase.from('login_history').insert({
      user_id: userId,
      email: email ?? null,
      platform: Platform.OS,
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
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  scansRemaining: 30,
  plan: 'free',
  role: null,
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
    } catch (e) {
      console.log('refreshScans failed', e);
    }
  },

  refreshRole: async () => {
    const user = get().user;
    if (!user) return;
    const r = await fetchRole(user.id);
    if (r) set({ role: r });
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      const ban = await checkBan(data.user.id);
      if (ban) return ban;
      set({ user: data.user, session: data.session, loading: false });
      await Promise.all([get().refreshScans(), get().refreshRole()]);
      await logLogin(data.user.id, data.user.email);
      return null;
    } catch (e: any) {
      return e?.message ?? 'Sign in failed';
    }
  },

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return error.message;
      if (data.user) {
        try {
          await supabase.from('user_scans').insert({
            user_id: data.user.id,
            scans_remaining: 30,
            plan: 'free',
          });
        } catch {}
        set({ user: data.user, session: data.session, loading: false, role: 'farmer' });
      }
      return null;
    } catch (e: any) {
      return e?.message ?? 'Sign up failed';
    }
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

      const existing = await supabase
        .from('user_profiles')
        .select('user_id, first_name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      let isNew = false;
      if (!existing.data) {
        isNew = true;
        const meta: any = session.user.user_metadata || {};
        const fullName = meta.full_name || meta.name || '';
        const parts = String(fullName).split(' ').filter(Boolean);
        const firstName = meta.given_name || parts[0] || '';
        const lastName = meta.family_name || parts.slice(1).join(' ') || '';
        const avatar = meta.avatar_url || meta.picture || null;

        try {
          await supabase.from('user_profiles').insert({
            user_id: session.user.id,
            email: session.user.email || '',
            first_name: firstName,
            last_name: lastName,
            avatar_url: avatar,
            role: 'farmer',
            verification_status: 'pending',
            account_status: 'active',
          });
        } catch (e) {
          console.log('profile insert failed', e);
        }
        try {
          await supabase.from('user_scans').insert({
            user_id: session.user.id,
            scans_remaining: 30,
            plan: 'free',
          });
        } catch (e) {
          console.log('scans insert failed', e);
        }
      }

      set({
        user: session.user,
        session,
        loading: false,
        role: 'farmer',
        isNewUser: isNew,
      });
      await Promise.all([get().refreshScans(), get().refreshRole()]);
      await logLogin(session.user.id, session.user.email);
      return null;
    } catch (e: any) {
      return e?.message ?? 'Google sign-in failed';
    }
  },

  resetPassword: async (email) => {
    try {
      const redirectTo = Linking.createURL('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return error?.message ?? null;
    } catch (e: any) {
      return e?.message ?? 'Reset failed';
    }
  },

  updatePassword: async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return error?.message ?? null;
    } catch (e: any) {
      return e?.message ?? 'Update failed';
    }
  },

  signInAsAgent: async (email, agentCode, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;

      const { data: prof } = await supabase
        .from('user_profiles')
        .select('role, agent_code')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!prof || prof.role !== 'agent') {
        await supabase.auth.signOut();
        return 'This account is not an agent account.';
      }
      if (!prof.agent_code || prof.agent_code.toLowerCase() !== agentCode.trim().toLowerCase()) {
        await supabase.auth.signOut();
        return 'Agent code does not match.';
      }

      const ban = await checkBan(data.user.id);
      if (ban) return ban;

      set({ user: data.user, session: data.session, loading: false, role: 'agent' });
      await Promise.all([get().refreshScans(), get().refreshRole()]);
      await logLogin(data.user.id, data.user.email);
      return null;
    } catch (e: any) {
      return e?.message ?? 'Agent sign in failed';
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    set({ user: null, session: null, scansRemaining: 0, plan: 'free', role: null, isNewUser: false });
  },
}));
