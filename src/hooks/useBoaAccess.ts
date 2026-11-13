import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from '../store/auth';

export function useBoaAccess() {
  const user = useAuth((s: any) => s.user);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setRole(data?.role || 'farmer');
      setLoading(false);
    })();
  }, [user]);

  const isAdmin = user?.email === 'darkmoorltd@gmail.com' || role === 'boa_admin';
  const isManager = role === 'boa_manager';
  const isOfficer = role === 'boa_officer';
  
  return {
    role,
    loading,
    hasAccess: isAdmin || isManager || isOfficer,
    isAdmin,
    isManager,
    isOfficer
  };
}
