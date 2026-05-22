import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

export function useSuperAdmin(): { isSuperAdmin: boolean; loading: boolean } {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsSuperAdmin(session?.user?.app_metadata?.["is_super_admin"] === true);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSuperAdmin(session?.user?.app_metadata?.["is_super_admin"] === true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isSuperAdmin, loading };
}
