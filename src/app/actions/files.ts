"use server";

import { createClient } from "../../utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadFile(formData: FormData, parentId: string | null = null) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized access. Quantum node rejected.");
    }

    const file = formData.get("file") as File;
    // ফোল্ডার আপলোডের ক্ষেত্রে ওয়েবকিট পাথ (relative path) ট্র্যাক করা
    const relativePath = (formData.get("relativePath") as string) || file.name;

    if (!file) {
      throw new Error("No file payload detected.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ফোল্ডার স্ট্রাকচার অক্ষুণ্ন রেখে পাথ তৈরি করা
    const filePath = `${user.id}/${Date.now()}-${relativePath}`;

    // mndrive বাকেটে আপলোড
    const { error: storageError } = await supabase
      .storage
      .from("mndrive")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) throw storageError;

    const { data: { publicUrl } } = supabase
      .storage
      .from("mndrive")
      .getPublicUrl(filePath);

    // mndrive ডাটাবেজে মেটাডাটা সেভ করা
    const { data: dbData, error: dbError } = await supabase
      .from("mndrive")
      .insert([
        {
          name: relativePath, // ফোল্ডারসহ পুরো পাথটি নাম হিসেবে সেভ হবে
          type: file.type || "application/octet-stream",
          size: file.size,
          url: publicUrl,
          parent_id: parentId || null,
          owner_id: user.id,
        },
      ])
      .select();

    if (dbError) throw dbError;

    revalidatePath("/");
    return { success: true, data: dbData };
  } catch (error: any) {
    console.error("mndrive upload error:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteFile(fileId: string, filePath: string) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized access. Quantum node rejected.");
    }

    if (!fileId) {
      throw new Error("Missing fileId.");
    }

    if (!filePath) {
      throw new Error("Missing storage object key (filePath).");
    }

    // Delete storage object (ignore errors if object already missing)
    const { error: storageError } = await supabase
      .storage
      .from("mndrive")
      .remove([filePath]);

    if (storageError) {
      // Some setups throw when object is missing; don’t block DB cleanup.
      console.warn("mndrive storage remove error:", storageError);
    }

    // Delete row in DB for this owner only
    const { error: dbError } = await supabase
      .from("mndrive")
      .delete()
      .eq("id", fileId)
      .eq("owner_id", user.id);

    if (dbError) throw dbError;

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("mndrive delete error:", error);
    return { success: false, error: error.message };
  }
}

// ১. ফাইলকে বিনে পাঠানো (Soft Delete)
export async function moveToTrash(fileIds: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized access.");

    const { data, error } = await supabase
      .from("mndrive")
      .update({ is_deleted: true })
      .in("id", fileIds) // একাধিক আইডি একসাথে আপডেট করবে
      .eq("owner_id", user.id);

    if (error) throw error;
    
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Move to trash error:", error);
    return { success: false, error: error.message };
  }
}

// ২. বিন থেকে চিরতরে ডিলিট করা (Permanent Hard Delete)
export async function deletePermanently(fileIds: string[], filePaths: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized access.");

    // ক) প্রথমে Supabase Storage থেকে ফাইলগুলো মুছে ফেলা
    if (filePaths.length > 0) {
      // খালি বা আনডিফাইন্ড পাথ ফিল্টার করে নেওয়া
      const validPaths = filePaths.filter(path => path && path.trim() !== "");
      if (validPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("mndrive")
          .remove(validPaths);
          
        if (storageError) console.error("Storage delete warning:", storageError);
      }
    }

    // খ) এবার Database Table থেকে রেকর্ড চিরতরে ডিলিট করা
    const { error: dbError } = await supabase
      .from("mndrive")
      .delete()
      .in("id", fileIds)
      .eq("owner_id", user.id);

    if (dbError) throw dbError;

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Permanent delete error:", error);
    return { success: false, error: error.message };
  }
}
// ৩. বিন থেকে ফাইল আবার মেইন ড্রাইভে রিস্টোর করা
export async function restoreFromTrash(fileIds: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized access.");

    const { error } = await supabase
      .from("mndrive")
      .update({ is_deleted: false }) // is_deleted আবার false করে দেওয়া হচ্ছে
      .in("id", fileIds)
      .eq("owner_id", user.id);

    if (error) throw error;
    
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Restore from trash error:", error);
    return { success: false, error: error.message };
  }
}