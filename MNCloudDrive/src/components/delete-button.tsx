"use client";

import { useState } from "react";
import { deleteFile } from "@/app/actions/files";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function DeleteButton({
  fileId,
  fileUrl,
}: {
  fileId: string;
  fileUrl: string | null | undefined;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to purge this data segment?")) return;

    try {
      setIsDeleting(true);
      
      if (!fileUrl) {
        alert("Missing file URL.");
        return;
      }

      // Supabase public URL থেকে storage object key বের করা
      // প্রত্যাশিত pattern: /object/public/mndrive/<filePath>
      // উদাহরণ: https://xxxx.supabase.co/storage/v1/object/public/mndrive/<filePath>
      const marker = "/object/public/mndrive/";
      const idx = fileUrl.indexOf(marker);
      if (idx === -1) {
        alert("Unable to determine storage path from file URL.");
        return;
      }
      const filePath = fileUrl.slice(idx + marker.length);
      if (!filePath) {
        alert("Storage path is empty.");
        return;
      }


      const result = await deleteFile(fileId, filePath);
      if (result.success) {
        router.refresh();
      } else {
        alert(`Purge Failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-slate-500 disabled:opacity-50"
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}