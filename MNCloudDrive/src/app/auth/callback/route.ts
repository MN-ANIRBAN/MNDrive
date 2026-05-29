import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // যদি কোন 'next' প্যারামিটার থাকে (লগইনের পর নির্দিষ্ট কোন পেজে পাঠানোর জন্য)
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }


  // যদি কোন সমস্যা হয়, তবে ইউজারকে এরর মেসেজ সহ আবার লগইন পেজে ফেরত পাঠাবে
  return NextResponse.redirect(`${origin}/login?message=Could not invalidate auth token.&type=error`)
}