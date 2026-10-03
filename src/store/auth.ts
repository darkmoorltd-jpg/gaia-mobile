import { create } from 'zustand';
import { supabase } from '../api/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  scansRemaining: number;
  plan: string;

  setUser: (u: User | null) => void;
  setAuth: (u: User | null, s: Session | null) => void;
  setScans: (n: number, plan: string) => void;
  refreshScans: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  scansRemaining: 30,
  plan: 'free',

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
      if (data) {
        set({ scansRemaining: data.scans_remaining, plan: data.plan });
      }
    } catch (e) {
      console.log('refreshScans failed', e);
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return error.message;

      // BAN CHECK
      try {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('banned_until, banned_reason')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (prof?.banned_until && new Date(prof.banned_until) > new Date()) {
          await supabase.auth.signOut();
          const until = new Date(prof.banned_until).toLocaleString();
          return `Your account is suspended until ${until}. ${prof.banned_reason || ''}`;
        }
      } catch {}

      set({ user: data.user, session: data.session, loading: false });
      await get().refreshScans();
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
        set({ user: data.user, session: data.session, loading: false });
      }
      return null;
    } catch (e: any) {
      return e?.message ?? 'Sign up failed';
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    set({ user: null, session: null, scansRemaining: 0, plan: 'free' });
  },
}));
