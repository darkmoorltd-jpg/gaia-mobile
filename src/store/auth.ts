
import { create } from 'zustand';
import { supabase } from '../api/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  scansRemaining: number;
  plan: string;
  setAuth: (user: User | null, session: Session | null) => void;
  setScans: (n: number, plan: string) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshScans: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  scansRemaining: 30,
  plan: 'free',

  setAuth: (user, session) => set({ user, session, loading: false }),
  setScans: (n, plan) => set({ scansRemaining: n, plan }),

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    set({ user: data.user, session: data.session });
    await get().refreshScans();
    return null;
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (data.user) {
      await supabase.from('user_scans').insert({
        user_id: data.user.id,
        scans_remaining: 30,
        plan: 'free',
      });
      set({ user: data.user, session: data.session });
    }
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, scansRemaining: 0, plan: 'free' });
  },

  refreshScans: async () => {
    const user = get().user;
    if (!user) return;
    const { data } = await supabase
      .from('user_scans')
      .select('scans_remaining, plan')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) set({ scansRemaining: data.scans_remaining, plan: data.plan });
  },
}));
