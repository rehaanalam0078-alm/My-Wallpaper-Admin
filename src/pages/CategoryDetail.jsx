import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Plus, RefreshCw } from "lucide-react";
import WallpaperCard from "../components/WallpaperCard";
import WallpaperInspector from "../components/WallpaperInspector";
import DeleteModal from "../components/DeleteModal";
import {
  fetchAllWallpapers,
  deleteWallpaperDoc,
  updateWallpaperDoc
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

  const categoryName = getCategoryDisplayName(rawCategory);

  const loadWallpapers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllWallpapers();
      setWallpapers(data);
    } catch {
      error("Could not fetch wallpapers.");
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
      error(err.message || "Failed to update.");
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
              Canonical key: <code className="font-mono text-[#c0c1ff]">{normalizeCategory(rawCategory)}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/upload?category=${rawCategory}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Upload to {categoryName}</span>
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

      {/* Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#6366f1] animate-spin" />
          <span className="font-mono text-xs text-[#908fa0]">Loading category assets...</span>
        </div>
      ) : categoryWallpapers.length === 0 ? (
        <div className="p-16 rounded-2xl bg-[#192029] border border-[#2A374A] text-center space-y-3">
          <h3 className="font-bold text-sm text-[#dce3f0]">No wallpapers in this category</h3>
          <p className="text-xs text-[#908fa0]">
            Upload images to populate the {categoryName} feed.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categoryWallpapers.map((wp) => (
            <WallpaperCard
              key={wp.id}
              wallpaper={wp}
              onInspect={(w) => setInspectingWallpaper(w)}
              onEdit={(w) => setInspectingWallpaper(w)}
              onDelete={(w) => setDeletingWallpaper(w)}
            />
          ))}
        </section>
      )}

      {inspectingWallpaper && (
        <WallpaperInspector
          wallpaper={inspectingWallpaper}
          onClose={() => setInspectingWallpaper(null)}
          onSaveCategory={handleSaveInspector}
          onDelete={(w) => setDeletingWallpaper(w)}
        />
      )}

      <DeleteModal
        isOpen={!!deletingWallpaper}
        wallpaper={deletingWallpaper}
        onClose={() => setDeletingWallpaper(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
