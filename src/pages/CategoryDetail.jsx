import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Plus, RefreshCw, Edit3 } from "lucide-react";
import WallpaperCard from "../components/WallpaperCard";
import WallpaperInspector from "../components/WallpaperInspector";
import DeleteModal from "../components/DeleteModal";
import CategoryModal from "../components/CategoryModal";
import {
  fetchAllWallpapers,
  deleteWallpaperDoc,
  updateWallpaperDoc,
  renameCategory
} from "../services/firestoreService";
import {
  getCategoryDisplayName,
  isCategoryMatch,
  normalizeCategory
} from "../services/categoryNormalizer";
import { useToast } from "../context/ToastContext";

export default function CategoryDetail() {
  const { category: rawCategory } = useParams();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [wallpapers, setWallpapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [inspectingWallpaper, setInspectingWallpaper] = useState(null);
  const [deletingWallpaper, setDeletingWallpaper] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);

  const categoryName = getCategoryDisplayName(rawCategory);
  const normalizedKey = normalizeCategory(rawCategory);

  const loadWallpapers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllWallpapers();
      setWallpapers(data);
    } catch {
      error("Could not fetch wallpapers from Firestore.");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadWallpapers();
  }, [loadWallpapers]);

  const categoryWallpapers = useMemo(() => {
    return wallpapers.filter((wp) => {
      if (!isCategoryMatch(wp.category, rawCategory)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (wp.title || "").toLowerCase().includes(q);
        const matchFilename = (wp.filename || "").toLowerCase().includes(q);
        return matchTitle || matchFilename;
      }
      return true;
    });
  }, [wallpapers, rawCategory, searchQuery]);

  const handleSaveInspector = async (docId, updates) => {
    try {
      await updateWallpaperDoc(docId, updates);
      success("Wallpaper updated.");
      loadWallpapers();
    } catch (err) {
      error(err.message || "Failed to update wallpaper.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingWallpaper) return;
    setDeleteLoading(true);
    try {
      await deleteWallpaperDoc(deletingWallpaper.id);
      success("Wallpaper deleted.");
      setDeletingWallpaper(null);
      if (inspectingWallpaper?.id === deletingWallpaper.id) {
        setInspectingWallpaper(null);
      }
      loadWallpapers();
    } catch (err) {
      error(err.message || "Failed to delete.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRename = async (newRawName) => {
    try {
      const res = await renameCategory(normalizedKey, newRawName);
      success(`Category renamed to "${res.displayName}" (${res.updatedWallpapersCount} wallpapers updated).`);
      setRenameModalOpen(false);
      navigate(`/categories/${res.newKey}`, { replace: true });
    } catch (err) {
      error(err.message || "Failed to rename category.");
      throw err;
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1720px] mx-auto space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A374A] pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/categories")}
            className="p-2 rounded-lg bg-[#192029] hover:bg-[#232a34] border border-[#2A374A] text-[#dce3f0] transition-colors"
            title="Back to Categories"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-[#dce3f0] tracking-tight">
                {categoryName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#192029] text-[#4cd7f6] font-mono text-xs border border-[#2A374A]">
                {categoryWallpapers.length} Wallpapers
              </span>
            </div>
            <p className="text-xs lg:text-sm text-[#908fa0]">
              Canonical key: <code className="font-mono text-[#c0c1ff]">{normalizedKey}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadWallpapers}
            disabled={loading}
            className="p-2 rounded-lg bg-[#192029] hover:bg-[#232a34] border border-[#2A374A] text-[#dce3f0] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setRenameModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-[#dce3f0] text-xs font-semibold transition-all"
          >
            <Edit3 className="w-4 h-4 text-[#c0c1ff]" />
            <span>Rename Category</span>
          </button>

          <button
            onClick={() => navigate(`/upload?category=${rawCategory}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Wallpapers</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#908fa0] pointer-events-none">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search within ${categoryName}...`}
          className="w-full pl-9 pr-4 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] placeholder-[#908fa0] text-xs focus:outline-none focus:border-[#6366f1]"
        />
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#6366f1] animate-spin" />
          <span className="font-mono text-xs text-[#908fa0]">
            Loading {categoryName} wallpapers...
          </span>
        </div>
      ) : categoryWallpapers.length === 0 ? (
        <div className="p-16 rounded-xl border border-dashed border-[#2A374A] flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-semibold text-[#dce3f0]">No wallpapers found in this category</p>
          <p className="text-xs text-[#908fa0]">Upload wallpapers to this category or change filter terms.</p>
          <button
            onClick={() => navigate(`/upload?category=${rawCategory}`)}
            className="mt-2 px-4 py-2 rounded-lg bg-[#6366f1] text-white text-xs font-semibold"
          >
            Upload Now
          </button>
        </div>
      ) : (
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {categoryWallpapers.map((wp) => (
            <WallpaperCard
              key={wp.id}
              wallpaper={wp}
              onInspect={(w) => setInspectingWallpaper(w)}
              onDelete={(w) => setDeletingWallpaper(w)}
            />
          ))}
        </section>
      )}

      {/* Slide-out Inspector Drawer */}
      {inspectingWallpaper && (
        <WallpaperInspector
          wallpaper={inspectingWallpaper}
          onClose={() => setInspectingWallpaper(null)}
          onSaveCategory={handleSaveInspector}
          onDelete={(w) => setDeletingWallpaper(w)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingWallpaper && (
        <DeleteModal
          isOpen={!!deletingWallpaper}
          onClose={() => setDeletingWallpaper(null)}
          onConfirm={handleConfirmDelete}
          loading={deleteLoading}
          title="Delete Wallpaper"
          description={`Are you sure you want to delete "${deletingWallpaper.title || "this wallpaper"}"? This permanently removes the Firestore metadata.`}
        />
      )}

      {/* Rename Category Modal */}
      {renameModalOpen && (
        <CategoryModal
          isOpen={renameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          onSave={handleRename}
          initialName={categoryName}
          title={`Rename Category: ${categoryName}`}
          actionLabel="Save & Update All Wallpapers"
          isRename={true}
        />
      )}
    </div>
  );
}
