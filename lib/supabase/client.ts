"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Uses ONLY the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY). This key
 * is safe to ship to the browser — every table it can reach is governed
 * by the existing Row Level Security policies already in production.
 * Never import a service_role key into this file or any file under app/.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.local.example to .env.local and fill them in."
    );
  }

  return createBrowserClient(url, anonKey);
}
