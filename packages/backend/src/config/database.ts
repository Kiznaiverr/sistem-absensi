import { createClient } from "@supabase/supabase-js";
import env from "./env.js";

if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Supabase configuration is missing");
}

export const supabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      },
    },
  },
);

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    },
  },
);

export default supabaseClient;
