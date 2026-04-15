import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("⚠️ Missing Supabase environment variables! Supabase interactions will fail.");
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseServiceRoleKey || "placeholder_key", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
