import { getSupabaseEnv } from './env'

export function getMissingSupabaseEnvVars() {
  const missing: string[] = []

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return missing
}

export function formatSupabaseEnvStatus() {
  const env = getSupabaseEnv()
  if (env) return { ok: true as const, missing: [] as string[] }
  return { ok: false as const, missing: getMissingSupabaseEnvVars() }
}

