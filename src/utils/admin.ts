import { useEffect, useState } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from '../store/auth';

let _cache: { userId: string; isAdmin: boolean; isSuperAdmin: boolean } | null = null;

export function useIsAdmin() {
  const user = useAuth((s: any) => s.user);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    if (_cache && _cache.userId === user.id) {
      setIsAdmin(_cache.isAdmin);
      setIsSuperAdmin(_cache.isSuperAdmin);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('is_admin, is_super_admin')
          .eq('user_id', user.id)
          .maybeSingle();
        const a = !!data?.is_admin;
        const s = !!data?.is_super_admin;
        _cache = { userId: user.id, isAdmin: a, isSuperAdmin: s };
        setIsAdmin(a);
        setIsSuperAdmin(s);
      } catch (e) {
        console.warn('[admin] check failed', e);
      }
      setLoading(false);
    })();
  }, [user]);

  return { isAdmin, isSuperAdmin, loading };
}

export function clearAdminCache() {
  _cache = null;
}

// Non-hook version for one-off checks (rare)
export async function checkIsAdmin(userId: string): Promise<{ isAdmin: boolean; isSuperAdmin: boolean }> {
  if (_cache && _cache.userId === userId) {
    return { isAdmin: _cache.isAdmin, isSuperAdmin: _cache.isSuperAdmin };
  }
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('is_admin, is_super_admin')
      .eq('user_id', userId)
      .maybeSingle();
    return { isAdmin: !!data?.is_admin, isSuperAdmin: !!data?.is_super_admin };
  } catch {
    return { isAdmin: false, isSuperAdmin: false };
  }
}
