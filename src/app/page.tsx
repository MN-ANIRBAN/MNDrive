import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { FileManagerView } from "@/components/file-manager-view";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // mndrive টেবিল থেকে কারেন্ট ইউজারের সব ডাটা নিয়ে আসা
  const { data: files } = await supabase
    .from("mndrive")
    .select("*")
    .order("created_at", { ascending: false });

  const signOut = async () => {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    return redirect("/login");
  };

  return (
    <div className="flex h-screen bg-[#060a13] text-slate-100 overflow-hidden">
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Main Workspace */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* সার্চ ফিল্টার ও লাইভ লিস্ট কম্পোনেন্ট */}
          <FileManagerView initialFiles={files || []} />
        </main>
      </div>
    </div>
  );
}