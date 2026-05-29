import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component-এর ভেতর থেকে কল হলে এটি সেফলি ইগনোর হবে
          }
        },
      },
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
      // Ensure cookies are actually used for auth checks during server actions
      // (prevents RLS auth.uid() mismatches due to missing session cookies)
      global: {
        headers: {
          // Supabase SDK reads auth from cookies; this is a no-op if cookies are present.
        },
      },
    }
  )
}

