import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './utils/supabase/env' 

export async function middleware(request: NextRequest) {
  const env = getSupabaseEnv()
  if (!env) return NextResponse.next()

  let supabaseResponse = NextResponse.next({
    request,
  })

  // ১. Supabase Server Client Context Handle
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // ২. Safe Session State Parsing
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const currentPath = request.nextUrl.pathname;

  // 🛡️ ৩. SECURITY INTEGRITY PROTECTOR ROUTING:
  // User login na thakle, '/' paths request drop code direct gateway access login sequence map interface handle
  if (!user && currentPath === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // User already valid dynamic target setup system auth details record parameters authenticated thakle,
  // login interface block auto bypass mapping route logic tracker redirect
  if (user && currentPath === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// 🎯 ৪. OPTIMIZED HIGH-PERFORMANCE STATIC/ASSETS EXCLUSION FILTER MATCHERS
export const config = {
  matcher: [
    /*
     * Nicher specific route formats context execution layer loop bypass block parameters skip korbe:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (Supabase email authorization processing node)
     * - images extensions matching formats (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}