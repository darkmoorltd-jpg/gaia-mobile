import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';

export type BoaRole = 'boa_admin' | 'boa_manager' | 'boa_officer' | 'none';

export function useBoaAccess() {
  const [role, setRole] = useState<BoaRole | null>(null);
  
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('is_boa_viewer');
      setRole((data as BoaRole) || 'none');
    })();
  }, []);

  return {
    role,
    loading: role === null,
    hasAccess: role !== null && role !== 'none',
    isAdmin: role === 'boa_admin',
    isManager: role === 'boa_manager' || role === 'boa_admin',
    isOfficer: role === 'boa_officer',
  };
}
