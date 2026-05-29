"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Search, Folder, FileText, Download, HardDrive, Trash2, 
  RefreshCw, CheckSquare, Square, Trash, Loader2, LayoutGrid, 
  List, UploadCloud, ChevronRight, X, Eye, FolderPlus, 
  User, LogOut, ImageIcon, FileCode, Layers, Sun, Moon 
} from "lucide-react";
import { Input as SearchInput } from "@/components/ui/input";
import { moveToTrash, deletePermanently, restoreFromTrash } from "@/app/actions/files";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import JSZip from "jszip";

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatDateUTC(input: any) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getFileCategory(mimeType: string, fileName: string): "images" | "documents" | "folders" | "others" {
  if (fileName.includes("/") && !mimeType) return "folders";
  const type = mimeType?.toLowerCase() || "";
  if (type.startsWith("image/")) return "images";
  if (type.includes("pdf") || type.includes("word") || type.includes("text") || type.includes("sheet") || type.includes("zip")) return "documents";
  return "others";
}

export function FileManagerView({ initialFiles }: { initialFiles: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"vault" | "trash">("vault");
  const [layoutMode, setLayoutMode] = useState<"list" | "grid">("list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  
  const [currentPath, setCurrentPath] = useState<string[]>([]); 
  const [previewFile, setPreviewFile] = useState<any | null>(null); 
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false); 
  const [newFolderName, setNewFolderName] = useState(""); 
  
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [userData, setUserData] = useState<{ email?: string; name?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [theme]);

  useEffect(() => {
    async function fetchIdentity() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData({
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split("@")[0],
        });
      }
    }
    fetchIdentity();
  }, [supabase]);

  const handleLogout = async () => {
    if (confirm("Terminate current secure cloud session?")) {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }
  };

  const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024;
  const totalBytesUsed = initialFiles?.reduce((acc, file) => acc + (file.size || 0), 0) || 0;
  const totalPercent = Math.min((totalBytesUsed / STORAGE_LIMIT) * 100, 100);

  const stats = initialFiles?.reduce((acc, file) => {
    const cat = getFileCategory(file.type, file.name);
    if (cat !== "folders") {
      acc[cat] += file.size || 0;
    }
    return acc;
  }, { images: 0, documents: 0, others: 0 });

  const imgPercent = (stats.images / STORAGE_LIMIT) * 100;
  const docPercent = (stats.documents / STORAGE_LIMIT) * 100;
  const otherPercent = (stats.others / STORAGE_LIMIT) * 100;

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setUploadStatus("Constructing directory node...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const folderPath = currentPath.length > 0 
        ? `${currentPath.join("/")}/${newFolderName.trim()}/.keep`
        : `${newFolderName.trim()}/.keep`;

      const { error } = await supabase
        .from("mndrive")
        .insert([{
          name: folderPath,
          size: 0, 
          type: "application/x-directory",
          owner_id: user.id,
          is_deleted: false
        }]);

      if (error) throw error;

      setNewFolderName("");
      setIsFolderModalOpen(false);
      setUploadStatus("Directory synchronized!");
      setTimeout(() => setUploadStatus(null), 1500);
      router.refresh();
    } catch (error: any) {
      setUploadStatus(`Error: ${error.message}`);
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleUploadProcess = async (files: FileList | null, isFolderUpload = false) => {
    if (!files || files.length === 0) return;

    setUploadStatus(`Syncing ${files.length} segments...`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized.");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let finalRelativePath = file.name;
        if (isFolderUpload && file.webkitRelativePath) {
          finalRelativePath = currentPath.length > 0 
            ? `${currentPath.join("/")}/${file.webkitRelativePath}`
            : file.webkitRelativePath;
        } else if (currentPath.length > 0) {
          finalRelativePath = `${currentPath.join("/")}/${file.name}`;
        }

        setUploadStatus(`Uploading [${i + 1}/${files.length}] : ${file.name}`);
        const uniqueName = `${Date.now()}-${file.name}`;
        const storagePath = `${user.id}/${uniqueName}`;
        
        const { error: storageError } = await supabase.storage
          .from("mndrive")
          .upload(storagePath, file);

        if (storageError) throw storageError;

        const { data: { publicUrl } } = supabase.storage
          .from("mndrive")
          .getPublicUrl(storagePath);

        const { error: dbError } = await supabase
          .from("mndrive")
          .insert([{
            name: finalRelativePath,
            size: file.size,
            type: file.type,
            url: publicUrl,
            owner_id: user.id,
            is_deleted: false
          }]);

        if (dbError) throw dbError;
      }

      setUploadStatus("Nodes synchronized!");
      setTimeout(() => setUploadStatus(null), 2000);
      router.refresh();
    } catch (error: any) {
      setUploadStatus(`Failed: ${error.message}`);
      setTimeout(() => setUploadStatus(null), 4000);
    }
  };

  const currentPrefix = currentPath.length > 0 ? `${currentPath.join("/")}/` : "";
  const currentViewFiles = initialFiles?.filter(file => 
    viewMode === "trash" ? file.is_deleted === true : !file.is_deleted
  );

  const processedNodes = (() => {
    if (!currentViewFiles) return [];
    const nodesMap = new Map<string, any>();

    currentViewFiles.forEach(file => {
      if (file.name.startsWith(currentPrefix)) {
        const relativePath = file.name.slice(currentPrefix.length);
        const parts = relativePath.split("/");

        if (parts.length > 1) {
          const folderName = parts[0];
          if (!nodesMap.has(`folder-${folderName}`)) {
            nodesMap.set(`folder-${folderName}`, {
              id: `folder-${folderName}`,
              name: folderName,
              isFolder: true,
              size: 0,
              created_at: file.created_at,
              childFileIds: [] 
            });
          }
          const currentFolder = nodesMap.get(`folder-${folderName}`);
          currentFolder.size += file.size || 0;
          currentFolder.childFileIds.push(file.id);
        } else {
          if (file.name.endsWith("/.keep") && file.size === 0) return;
          nodesMap.set(file.id, { ...file, isFolder: false });
        }
      }
    });

    return Array.from(nodesMap.values());
  })();

  const filteredFiles = processedNodes.filter((node) =>
    node.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredFiles.length) setSelectedIds([]);
    else setSelectedIds(filteredFiles.map(f => f.id));
  };

  const getSelectedRealFileIds = () => {
    const finalIdsSet = new Set<string>();
    selectedIds.forEach(id => {
      if (id.startsWith("folder-")) {
        const targetFolder = filteredFiles.find(f => f.id === id);
        if (targetFolder && targetFolder.childFileIds) {
          targetFolder.childFileIds.forEach((childId: string) => finalIdsSet.add(childId));
        }
      } else {
        finalIdsSet.add(id);
      }
    });
    return Array.from(finalIdsSet);
  };

  const handleBulkDelete = async () => {
    const realFileIdsToProcess = getSelectedRealFileIds();
    if (realFileIdsToProcess.length === 0) return;
    if (!confirm("Confirm bundle deletion sequence?")) return;

    setUploadStatus("Processing bundle clear...");
    if (viewMode === "vault") {
      const res = await moveToTrash(realFileIdsToProcess);
      if (res.success) { setSelectedIds([]); router.refresh(); }
    } else {
      const selectedFilesData = initialFiles.filter(f => realFileIdsToProcess.includes(f.id));
      const filePaths = selectedFilesData.map(f => f.url?.split("/mndrive/")[1] || f.name);
      const res = await deletePermanently(realFileIdsToProcess, filePaths);
      if (res.success) { setSelectedIds([]); router.refresh(); }
    }
    setUploadStatus(null);
  };

  const handleBulkRestore = async () => {
    const realFileIdsToProcess = getSelectedRealFileIds();
    if (realFileIdsToProcess.length === 0) return;
    if (confirm("Restore selected tree nodes back to Core Vault?")) {
      const res = await restoreFromTrash(realFileIdsToProcess);
      if (res.success) { setSelectedIds([]); router.refresh(); }
    }
  };

  const handleBulkDownload = async () => {
    const realFileIdsToProcess = getSelectedRealFileIds();
    if (realFileIdsToProcess.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const file of initialFiles.filter(f => realFileIdsToProcess.includes(f.id))) {
        if (!file.url) continue;
        const response = await fetch(file.url);
        zip.file(file.name.split("/").pop() || file.name, await response.blob());
      }
      const zipContent = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipContent);
      a.download = `mndrive-bulk-${Date.now()}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleSingleDeleteFromPreview = async (fileId: string) => {
    if (confirm("Move this specific segment to Quantum Bin?")) {
      const res = await moveToTrash([fileId]);
      if (res.success) { setPreviewFile(null); router.refresh(); }
    }
  };

  const handleNodeClick = (node: any) => {
    if (node.isFolder) {
      setCurrentPath(prev => [...prev, node.name]);
      setSelectedIds([]);
    } else {
      setPreviewFile(node);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) setCurrentPath([]);
    else setCurrentPath(prev => prev.slice(0, index + 1));
    setSelectedIds([]);
  };

  return (
    /* 🚀 FIX: max-w wrapper bad diye 'w-full px-4 md:px-8' use kore layout full stretch kora hoyeche */
    <div className={`flex flex-col min-h-screen w-full overflow-x-hidden p-4 md:p-8 gap-6 transition-colors duration-500 ease-in-out ${theme === 'dark' ? 'bg-[#020617] text-slate-300' : 'bg-[#f8fafc] text-slate-700'}`}>
      
      {/* 🌌 TITLE HEADER SECTION */}
      <div className="w-full flex flex-col gap-1">
        <h1 className={`text-2xl font-extrabold tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Quantum Storage Node</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Manage your personal encrypted cloud matrix</p>
      </div>

      {/* 👤 TOP SECURE NAV BAR & THEME CONTROL */}
      <div className={`w-full flex flex-wrap items-center justify-between gap-4 p-4 border rounded-2xl backdrop-blur-xl shadow-sm transition-all duration-300 ${theme === 'dark' ? 'bg-[#0b111e]/45 border-slate-900/80 shadow-teal-500/[0.02]' : 'bg-white/80 border-slate-200/80 shadow-slate-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.05)] ${theme === 'dark' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-teal-50/60 border-teal-200 text-teal-600'}`}>
            <User size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Secure Profile</span>
            <span className={`text-sm font-bold transition-colors ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{userData?.name || "Initializing..."}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`p-2.5 rounded-xl border hover:scale-105 active:scale-95 transition-all duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-teal-400' : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-teal-600 hover:bg-slate-100'}`}
            title="Switch Environment Aura"
          >
            {theme === "dark" ? <Sun size={16} className="animate-pulse" /> : <Moon size={16} />}
          </button>

          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono ${theme === 'dark' ? 'bg-slate-950/40 border border-slate-900 text-slate-400' : 'bg-slate-100/80 border border-slate-200 text-slate-600'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Nodes: {initialFiles?.length || 0}
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 active:translate-y-0.5"
          >
            <LogOut size={14} /> <span className="hidden md:inline">Disconnect</span>
          </button>
        </div>
      </div>

      {/* 📊 CATEGORY-WISE ADVANCED STORAGE PANEL */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className={`p-4 border rounded-2xl backdrop-blur-xl space-y-3 shadow-sm transition-all duration-300 ${theme === 'dark' ? 'bg-[#0b111e]/45 border-slate-900/80 shadow-teal-500/[0.01]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5"><HardDrive size={14} className={theme === 'dark' ? 'text-teal-400' : 'text-teal-600'} /> Vault Volume</span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg ${theme === 'dark' ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>{totalPercent.toFixed(1)}%</span>
          </div>
          <p className={`text-xl font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{formatBytes(totalBytesUsed)} <span className="text-xs text-slate-400 font-normal">/ 5 GB</span></p>
          <div className={`w-full h-1.5 rounded-full overflow-hidden border flex ${theme === 'dark' ? 'bg-slate-950 border-slate-900/40' : 'bg-slate-100 border-slate-200/50'}`}>
            <div style={{ width: `${imgPercent}%` }} className="bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500 ease-out" />
            <div style={{ width: `${docPercent}%` }} className="bg-purple-500 transition-all duration-500 ease-out" />
            <div style={{ width: `${otherPercent}%` }} className="bg-amber-500 transition-all duration-500 ease-out" />
          </div>
        </div>

        <div className={`p-4 border rounded-2xl backdrop-blur-md flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#0b111e]/25 border-slate-900/40 hover:bg-slate-900/40' : 'bg-white border-slate-200/80 hover:bg-slate-50'}`}>
          <div className={`p-3 rounded-xl shadow-[0_0_15px_rgba(20,184,166,0.02)] ${theme === 'dark' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-teal-50 text-teal-600 border border-teal-100'}`}><ImageIcon size={20} /></div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Image Assets</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{formatBytes(stats.images)}</p>
          </div>
        </div>

        <div className={`p-4 border rounded-2xl backdrop-blur-md flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#0b111e]/25 border-slate-900/40 hover:bg-slate-900/40' : 'bg-white border-slate-200/80 hover:bg-slate-50'}`}>
          <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}><FileCode size={20} /></div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Documents Matrix</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{formatBytes(stats.documents)}</p>
          </div>
        </div>

        <div className={`p-4 border rounded-2xl backdrop-blur-md flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 ${theme === 'dark' ? 'bg-[#0b111e]/25 border-slate-900/40 hover:bg-slate-900/40' : 'bg-white border-slate-200/80 hover:bg-slate-50'}`}>
          <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}><Layers size={20} /></div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Other Clusters</p>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{formatBytes(stats.others)}</p>
          </div>
        </div>
      </div>

      {/* CONTROL ACTIONS MATRIX BAR */}
      <div className={`w-full flex flex-wrap items-center justify-between gap-4 p-4 border rounded-2xl backdrop-blur-xl shadow-sm ${theme === 'dark' ? 'bg-[#0b111e]/45 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center gap-1 p-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-950/20 border-slate-900/50' : 'bg-slate-50 border-slate-200/60'}`}>
          <button onClick={() => { setViewMode("vault"); setCurrentPath([]); setSelectedIds([]); }} className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${viewMode === "vault" ? (theme === 'dark' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-white text-teal-600 shadow-sm border border-slate-200') : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}>
            Core Vault
          </button>
          <button onClick={() => { setViewMode("trash"); setCurrentPath([]); setSelectedIds([]); }} className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${viewMode === "trash" ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-slate-400 hover:text-red-500 border border-transparent'}`}>
            <Trash className="h-3.5 w-3.5" /> Trash Bin
          </button>
        </div>

        {viewMode === "vault" && (
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={(e) => handleUploadProcess(e.target.files, false)} multiple className="hidden" />
            <input type="file" ref={folderInputRef} onChange={(e) => handleUploadProcess(e.target.files, true)} {...({ webkitdirectory: "", directory: "" } as any)} className="hidden" />

            <button onClick={() => setIsFolderModalOpen(true)} className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-teal-400 hover:border-teal-500/30' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-teal-600'}`}>
              <FolderPlus className="h-4 w-4" /> <span className="hidden sm:inline">Folder</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadStatus !== null} className={`px-3 py-2 rounded-xl border font-semibold text-xs uppercase transition-all duration-200 ${theme === 'dark' ? 'border-slate-800 text-slate-300 hover:bg-slate-950' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}>
              + Files
            </button>
            <button onClick={() => folderInputRef.current?.click()} disabled={uploadStatus !== null} className={`px-4 py-2 rounded-xl text-white font-bold text-xs uppercase hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 ${theme === 'dark' ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-slate-950' : 'bg-gradient-to-r from-teal-600 to-teal-500'}`}>
              <UploadCloud className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Upload Dir</span>
            </button>
          </div>
        )}

        <div className={`flex items-center gap-1 border p-1 rounded-xl ${theme === 'dark' ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
          <button onClick={() => setLayoutMode("list")} className={`p-1.5 rounded-lg transition-all duration-200 ${layoutMode === "list" ? (theme === 'dark' ? 'bg-slate-800 text-teal-400' : 'bg-white text-teal-600 shadow-sm') : 'text-slate-400 hover:text-slate-500'}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setLayoutMode("grid")} className={`p-1.5 rounded-lg transition-all duration-200 ${layoutMode === "grid" ? (theme === 'dark' ? 'bg-slate-800 text-teal-400' : 'bg-white text-teal-600 shadow-sm') : 'text-slate-400 hover:text-slate-500'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* STAGED BULK CONTROLLER */}
        {(selectedIds.length > 0 || isZipping || uploadStatus) && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border w-full md:w-auto justify-center md:justify-start animate-scaleIn shadow-lg ${theme === 'dark' ? 'bg-slate-950/90 border-slate-800' : 'bg-white border-slate-200'}`}>
            {uploadStatus ? (
              <div className="flex items-center gap-2 text-xs text-amber-500 font-semibold px-2 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{uploadStatus}</span>
              </div>
            ) : (
              <>
                <span className={`text-xs font-semibold mr-2 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`}>{selectedIds.length} Staged</span>
                {viewMode === "trash" && <button onClick={handleBulkRestore} className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-transform active:scale-95"><RefreshCw className="h-4 w-4" /></button>}
                {viewMode === "vault" && <button onClick={handleBulkDownload} className="p-2 hover:bg-teal-500/10 text-teal-500 rounded-lg transition-transform active:scale-95">{isZipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button>}
                <button onClick={handleBulkDelete} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-transform active:scale-95"><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </div>
        )}
      </div>

      {/* SEARCH CONTROLS & BREADCRUMB SLIDER */}
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 items-center shrink-0">
        <div className="md:col-span-4 relative w-full group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors h-4 w-4" />
          <SearchInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search index segment..." className={`pl-11 rounded-xl h-11 focus:ring-2 focus:ring-teal-500/10 transition-all duration-300 ${theme === 'dark' ? 'bg-slate-950/50 border-slate-800/80 text-slate-300 focus:border-teal-500/40' : 'bg-white border-slate-200 text-slate-800 focus:border-teal-500/60'}`} />
        </div>

        <div className={`md:col-span-8 flex items-center gap-2 text-xs font-medium p-3 rounded-xl border w-full overflow-x-auto no-scrollbar whitespace-nowrap ${theme === 'dark' ? 'bg-slate-950/30 border-slate-900/60' : 'bg-white border-slate-200/80'}`}>
          <button onClick={() => navigateToBreadcrumb(-1)} className={`transition-colors uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-slate-400 hover:text-teal-400' : 'text-slate-500 hover:text-teal-600'}`}>
            Root Vault
          </button>
          {currentPath.map((folder, idx) => (
            <div key={idx} className="flex items-center gap-2 text-slate-400">
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              <button onClick={() => navigateToBreadcrumb(idx)} className={`transition-colors font-semibold ${theme === 'dark' ? 'text-slate-300 hover:text-teal-400' : 'text-slate-700 hover:text-teal-600'}`}>
                {folder}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 🎴 SCROLLABLE FILE DIRECTORY MATRIX */}
      <div className="w-full flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-1">
        {layoutMode === "list" ? (
          <div className={`w-full border rounded-2xl overflow-hidden backdrop-blur-xl shadow-sm transition-all duration-300 animate-fadeIn ${theme === 'dark' ? 'bg-[#0b111e]/45 border-slate-900/80' : 'bg-white border-slate-200'}`}>
            <div className={`grid grid-cols-12 gap-4 px-6 py-3.5 border-b text-xs font-semibold uppercase tracking-wider text-slate-400 items-center ${theme === 'dark' ? 'border-slate-900 bg-slate-950/20' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="col-span-1 flex items-center">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600 transition-transform active:scale-75">
                  {selectedIds.length === filteredFiles?.length && filteredFiles.length > 0 ? <CheckSquare className={`h-4 w-4 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} /> : <Square className="h-4 w-4" />}
                </button>
              </div>
              <div className="col-span-6 md:col-span-5">Name</div>
              <div className="hidden md:block md:col-span-3">Date Actioned</div>
              <div className="col-span-3 md:col-span-2 text-right md:text-left">Size</div>
              <div className="col-span-2 md:col-span-1 text-right">Action</div>
            </div>

            <div className={`divide-y ${theme === 'dark' ? 'divide-slate-900/40' : 'divide-slate-100'}`}>
              {filteredFiles?.map((node) => {
                const isSelected = selectedIds.includes(node.id);
                return (
                  <div key={node.id} className={`grid grid-cols-12 gap-4 px-6 py-4 items-center text-sm transition-all duration-200 ${isSelected ? (theme === 'dark' ? 'bg-teal-500/[0.03]' : 'bg-teal-50/40') : (theme === 'dark' ? 'hover:bg-slate-950/40' : 'hover:bg-slate-50/60')}`}>
                    <div className="col-span-1 flex items-center">
                      <button onClick={() => toggleSelect(node.id)} className="text-slate-400 hover:text-teal-500 transition-colors">
                        {isSelected ? <CheckSquare className={`h-4 w-4 animate-scaleIn ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} /> : <Square className="h-4 w-4" />}
                      </button>
                    </div>

                    <div onClick={() => handleNodeClick(node)} className="col-span-6 md:col-span-5 flex items-center gap-3 min-w-0 cursor-pointer group">
                      <div className={`p-2 border rounded-xl flex-shrink-0 transition-transform group-hover:scale-110 ${node.isFolder ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' : (theme === 'dark' ? 'text-teal-400 border-slate-800 bg-slate-950/65' : 'text-teal-600 border-slate-200 bg-slate-50')}`}>
                        {node.isFolder ? <Folder className="h-4 w-4 fill-amber-500/10" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <span className={`truncate font-medium transition-colors ${theme === 'dark' ? 'text-slate-200 group-hover:text-teal-400' : 'text-slate-800 group-hover:text-teal-600'}`}>{node.name}</span>
                    </div>

                    <div className="hidden md:block md:col-span-3 text-slate-400 text-xs">{formatDateUTC(node.created_at)}</div>
                    <div className="col-span-3 md:col-span-2 text-xs text-slate-400 text-right md:text-left font-mono">{node.isFolder ? "---" : formatBytes(node.size)}</div>

                    <div className="col-span-2 md:col-span-1 flex items-center justify-end">
                      <button onClick={() => handleNodeClick(node)} className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'text-slate-500 hover:text-teal-400 hover:bg-slate-900' : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100'}`}>
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 🚀 FIX: Grid Layout screen size er shathe maximum 6 columns logic layout complete stretch korbe */
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fadeIn">
            {filteredFiles?.map((node) => {
              const isSelected = selectedIds.includes(node.id);
              const isImage = !node.isFolder && getFileCategory(node.type, node.name) === "images";

              return (
                <div 
                  key={node.id} 
                  className={`group relative p-3 border rounded-2xl cursor-pointer select-none transition-all duration-300 flex flex-col justify-between h-44 backdrop-blur-xl shadow-sm hover:-translate-y-1 ${isSelected ? (theme === 'dark' ? 'border-teal-500 bg-teal-500/[0.02]' : 'border-teal-500 bg-teal-50/[0.15] shadow-md') : (theme === 'dark' ? 'border-slate-900 hover:border-slate-800 hover:shadow-lg' : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md')}`}
                >
                  <div className="absolute top-2.5 left-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(node.id); }} className="transition-transform active:scale-75">
                      {isSelected ? <CheckSquare className={`h-4 w-4 shadow-md ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} /> : <Square className="h-4 w-4 text-slate-400" />}
                    </button>
                  </div>

                  <div onClick={() => handleNodeClick(node)} className={`w-full flex-1 flex items-center justify-center rounded-xl border overflow-hidden mb-3 p-1 transition-colors ${theme === 'dark' ? 'bg-slate-950/50 border-slate-900/60 group-hover:border-slate-700' : 'bg-slate-50 border-slate-150 group-hover:border-slate-300'}`}>
                    {node.isFolder ? (
                      <Folder className="h-12 w-12 text-amber-500 fill-amber-500/5 group-hover:scale-110 transition-transform duration-300 ease-out" />
                    ) : isImage && node.url ? (
                      <img src={node.url} alt={node.name} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500 ease-out" />
                    ) : (
                      <FileText className={`h-8 w-8 group-hover:scale-110 transition-transform duration-300 ease-out ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
                    )}
                  </div>

                  <div onClick={() => handleNodeClick(node)} className="space-y-0.5">
                    <p className={`text-xs font-semibold truncate pr-1 transition-colors ${theme === 'dark' ? 'text-slate-200 group-hover:text-teal-400' : 'text-slate-800 group-hover:text-teal-600'}`}>{node.name}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>{node.isFolder ? "Folder" : formatBytes(node.size)}</span>
                      <span className="uppercase font-bold text-[9px] text-slate-400">{node.isFolder ? "DIR" : (node.type?.split("/")[1] || "NODE")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredFiles?.length === 0 && (
          <div className="w-full flex flex-col items-center justify-center py-24 text-center animate-fadeIn">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border mb-4 ${theme === 'dark' ? 'bg-slate-950 border-slate-900' : 'bg-slate-100 border-slate-200'}`}><HardDrive className="h-6 w-6 animate-bounce text-slate-400" /></div>
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Empty directory segment</h3>
            <p className="text-xs text-slate-400 mt-1">No data fragments recorded in this block.</p>
          </div>
        )}
      </div>

      {/* --- INITIATE FOLDER MODAL CONTAINER --- */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <form onSubmit={handleCreateFolder} className={`border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-scaleIn ${theme === 'dark' ? 'bg-[#0b111e]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                <FolderPlus className="h-4 w-4 text-amber-500" /> Initialize New Directory
              </h3>
              <button type="button" onClick={() => setIsFolderModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-transform active:scale-75"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Directory Name</label>
              <SearchInput value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g., Production-Logs" className={`h-10 rounded-xl focus:ring-2 focus:ring-teal-500/10 ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`} autoFocus />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsFolderModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              <button type="submit" className={`px-4 py-1.5 text-white font-bold text-xs uppercase rounded-xl hover:brightness-110 active:scale-95 transition-all ${theme === 'dark' ? 'bg-gradient-to-r from-teal-500 to-teal-600' : 'bg-gradient-to-r from-teal-600 to-teal-500'}`}>Create Node</button>
            </div>
          </form>
        </div>
      )}

      {/* --- LIVE PREVIEW MODAL MODULE --- */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className={`border rounded-3xl max-w-2xl w-full p-6 relative flex flex-col max-h-[85vh] shadow-2xl animate-scaleIn ${theme === 'dark' ? 'bg-[#0b111e] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-4 mb-4 ${theme === 'dark' ? 'border-slate-900' : 'border-slate-100'}`}>
              <div className="min-w-0">
                <h3 className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{previewFile.name.split("/").pop()}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{formatBytes(previewFile.size)} | Type: {previewFile.type || "Unknown Node"}</p>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto flex items-center justify-center rounded-2xl border p-2 min-h-[250px] ${theme === 'dark' ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'}`}>
              {getFileCategory(previewFile.type, previewFile.name) === "images" && previewFile.url ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-[48vh] object-contain rounded-lg shadow-sm animate-scaleIn animate-duration-500" />
              ) : (
                <div className="text-center space-y-3 p-6">
                  <div className={`p-4 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto border ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-200/60 border-slate-300/40'}`}>
                    <FileText className={`h-8 w-8 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm">No live preview engine available for this block extension format.</p>
                </div>
              )}
            </div>

            <div className={`flex items-center justify-between border-t pt-4 mt-4 ${theme === 'dark' ? 'border-slate-900' : 'border-slate-100'}`}>
              <button onClick={() => handleSingleDeleteFromPreview(previewFile.id)} className="px-3 py-2 border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Purge Node
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreviewFile(null)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600">Close</button>
                {previewFile.url && (
                  <a href={previewFile.url} download target="_blank" className={`px-4 py-2 text-white font-bold text-xs uppercase rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-md ${theme === 'dark' ? 'bg-gradient-to-r from-teal-500 to-teal-600' : 'bg-gradient-to-r from-teal-600 to-teal-500'}`}>
                    <Download className="h-3.5 w-3.5" /> Download Node
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ Dynamic Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #0d9488; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        
        .animate-fadeIn { animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scaleIn { animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>

    </div>
  );
}