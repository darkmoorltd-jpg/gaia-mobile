import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';

export type BoaRole = 'boa_admin' | 'boa_manager' | 'boa_officer' | 'none';

export function useBoaAccess() {
  const [role, setRole] = useState<BoaRole | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // New: boa_get_role() returns text ('boa_admin' | 'boa_manager' | 'boa_officer' | 'none')
        const { data, error } = await supabase.rpc('boa_get_role');
        if (error) {
          console.warn('BOA role check failed:', error.message);
          setRole('none');
          return;
        }

        if (typeof data === 'string') {
          setRole(data as BoaRole);
        } else {
          // Fallback if the function isn't deployed yet
          setRole('none');
        }
      } catch (e) {
        console.error('BOA role exception:', e);
        setRole('none');
      }
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
