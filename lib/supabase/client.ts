import { createBrowserClient } from "@supabase/ssr";

// Get environment variables directly to avoid Node.js process.version checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
