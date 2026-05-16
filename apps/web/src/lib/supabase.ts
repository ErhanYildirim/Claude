import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY env değişkenleri zorunlu.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
