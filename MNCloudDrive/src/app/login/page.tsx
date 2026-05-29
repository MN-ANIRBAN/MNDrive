import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Mail, Terminal, ShieldAlert, Sparkles } from "lucide-react";

interface SearchParamsProps {
  searchParams: Promise<{ message?: string; type?: string }>;
}

export default async function LoginPage({ searchParams }: SearchParamsProps) {
  const resolvedParams = await searchParams;
  const message = resolvedParams?.message;
  const messageType = resolvedParams?.type;

  // ১. ইউজার সেশন চেক অ্যান্ড ডিরেক্ট কোর রিডাইরেকশন 
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return redirect("/");
    }
  }

  // ২. Server Action: অথরাইজেশন সেশন এক্সিকিউশন
  const signIn = async (formData: FormData) => {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = await createClient();

    if (!supabase) {
      return redirect("/login?message=Supabase configuration missing.&type=error");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect(`/login?message=${encodeURIComponent(error.message)}&type=error`);
    }

    return redirect("/");
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* 🔮 হাই-ফিডেলিটি ইন্টারঅ্যাক্টিভ ম্যাট্রিক্স সাইবার নোড গ্রিড ব্যাকগ্রাউন্ড */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />
      
      {/* ⚡ ডাইনামিক গ্লো কনটেইনার্স */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/[0.06] rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/[0.06] rounded-full blur-[120px] pointer-events-none animate-pulse duration-[4000ms]" />

      <div className="w-full max-w-md bg-[#090d16]/70 border border-slate-900/90 backdrop-blur-2xl p-8 rounded-[24px] shadow-[0_0_50px_-12px_rgba(20,184,166,0.12)] relative z-10 transition-all">
        
        {/* 🛡️ টপ প্রিমিয়াম ব্যাজ */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] uppercase tracking-widest font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
            Secure Matrix Gateway v2.4
          </div>
        </div>

        {/* ব্র্যান্ডিং / লোগো হেডার */}
        <div className="flex flex-col items-center mb-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Initialize Core Session
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide mt-1.5">
            Establish authenticated pipeline to NeoDrive Grid
          </p>
        </div>

        {/* 📊 ডায়নামিক সেশন অ্যালার্ট নোটিফিকেশন ইন্টারফেস */}
        {message && (
          <div className={`p-4 rounded-xl border text-xs font-medium mb-6 flex items-start gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 ${
            messageType === "error" 
              ? "bg-red-500/[0.06] border-red-500/20 text-red-400" 
              : "bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-400"
          }`}>
            {messageType === "error" ? (
              <ShieldAlert className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{message}</span>
          </div>
        )}

        {/* মেইন ইন্টারফেস ফর্ম */}
        <form className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Identity</label>
              <span className="text-[9px] font-mono text-slate-600">REQUIRED</span>
            </div>
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4 group-focus-within:text-teal-400 transition-colors" />
              <Input 
                name="email" 
                type="email" 
                placeholder="operator@matrix.core" 
                required 
                className="pl-11 bg-slate-950/60 border-slate-900 text-slate-200 rounded-xl h-12 focus-visible:ring-teal-500/30 focus-visible:border-teal-500 text-sm transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Security Access Key</label>
              <span className="text-[9px] font-mono text-slate-600">ENCRYPTED</span>
            </div>
            <div className="relative group">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4 group-focus-within:text-teal-400 transition-colors" />
              <Input 
                name="password" 
                type="password" 
                placeholder="••••••••" 
                required 
                className="pl-11 bg-slate-950/60 border-slate-900 text-slate-200 rounded-xl h-12 focus-visible:ring-teal-500/30 focus-visible:border-teal-500 text-sm transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* সাবমিশন অ্যান্ড অ্যাকশন ব্লক প্যানেল */}
          <div className="flex flex-col gap-3 pt-3">
            <Button 
              formAction={signIn} 
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold uppercase text-xs tracking-wider rounded-xl h-12 shadow-[0_4px_20px_rgba(20,184,166,0.15)] transition-all active:scale-[0.99]"
            >
              Authorize Identity Node
            </Button>
          </div>
        </form>

        {/* 🔒 ফুটর প্রটেকশন নোটিশ */}
        <div className="mt-8 pt-4 border-t border-slate-900/60 text-center">
          <p className="text-[10px] text-slate-600 tracking-wide font-mono flex items-center justify-center gap-1">
            End-to-End Cryptographic Security Session Active
          </p>
        </div>

      </div>
    </div>
  );
}