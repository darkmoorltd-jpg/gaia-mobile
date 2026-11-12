import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';

export type BoaRole = 'boa_admin' | 'boa_manager' | 'boa_officer' | 'none';

export function useBoaAccess() {
  const [role, setRole] = useState<BoaRole | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc('is_boa_viewer');
        if (error) {
          console.warn('BOA check failed:', error.message);
          setRole('none');
          return;
        }
        
        // Handle old SQL version returning boolean, or new version returning string
        if (data === true) {
          setRole('boa_admin');
        } else if (typeof data === 'string') {
          setRole(data as BoaRole);
        } else {
          setRole('none');
        }
      } catch (e) {
        console.error('BOA exception:', e);
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
