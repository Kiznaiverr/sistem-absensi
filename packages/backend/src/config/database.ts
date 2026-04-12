import { createClient } from "@supabase/supabase-js";
import env from "./env.js";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  throw new Error("Supabase configuration is missing");
}

export const supabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    },
  },
);

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  },
);

export default supabaseClient;
