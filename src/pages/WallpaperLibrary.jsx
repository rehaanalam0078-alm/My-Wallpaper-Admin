import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Grid,
  List,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Star
} from "lucide-react";
import WallpaperCard from "../components/WallpaperCard";
import WallpaperInspector from "../components/WallpaperInspector";
import DeleteModal from "../components/DeleteModal";
import {
  fetchAllWallpapers,
  fetchCategories,
  deleteWallpaperDoc,
  updateWallpaperDoc,
  setFeaturedWallpaper
} from "../services/firestoreService";
import {
  normalizeCategory,
  getCategoryDisplayName,
  isCategoryMatch
} from "../services/categoryNormalizer";
import { useToast } from "../context/ToastContext";

export default function WallpaperLibrary() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [wallpapers, setWallpapers] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const initialCategory = searchParams.get("category") || "all";
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");

  // Selection & Inspector
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [inspectingWallpaper, setInspectingWallpaper] = useState(null);
  const [deletingWallpaper, setDeletingWallpaper] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 18;

  const loadWallpapers = useCallback(async () => {
    setLoading(true);
    try {
      const [wpData, catData] = await Promise.all([
        fetchAllWallpapers(),
        fetchCategories()
      ]);
      setWallpapers(wpData);
      setAllCategories(catData);
    } catch (err) {
      console.error(err);
      error("Could not fetch wallpapers from Firestore.");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadWallpapers();
  }, [loadWallpapers]);

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  // Extract all categories found in database and categories collection
  const dynamicCategories = useMemo(() => {
    const catMap = new Map();
    allCategories.forEach((c) => catMap.set(c.key, c.key));
    wallpapers.forEach((wp) => {
      if (wp.category) {
        const norm = normalizeCategory(wp.category);
        catMap.set(norm, norm);
      }
    });
    return Array.from(catMap.values());
  }, [allCategories, wallpapers]);

  // Filter & Sort
  const filteredWallpapers = useMemo(() => {
    return wallpapers
      .filter((wp) => {
        // Category match
        if (selectedCategory !== "all") {
          if (!isCategoryMatch(wp.category, selectedCategory)) {
            return false;
          }
        }

        // Search match
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = (wp.title || "").toLowerCase().includes(q);
          const matchFilename = (wp.filename || "").toLowerCase().includes(q);
          const matchCategory = (wp.category || "").toLowerCase().includes(q);
          const matchId = (wp.id || "").toLowerCase().includes(q);
          if (!matchTitle && !matchFilename && !matchCategory && !matchId) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          const timeA = a.timestamp || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.timestamp || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeA - timeB;
        }
        if (sortBy === "featured") {
          return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        }
        if (sortBy === "category") {
          return (a.category || "").localeCompare(b.category || "");
        }
        // Newest first (default)
        const timeA = a.timestamp || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.timestamp || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
  }, [wallpapers, selectedCategory, searchQuery, sortBy]);

  // Pagination calculation
  const totalItems = filteredWallpapers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedWallpapers = filteredWallpapers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Selection toggle
  const toggleSelect = (id) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      paginatedWallpapers.forEach((wp) => next.add(wp.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedDocIds(new Set());
  };

  // Actions
  const handleToggleFeatured = async (wallpaper) => {
    const newStatus = !wallpaper.isFeatured;
    try {
      await setFeaturedWallpaper(wallpaper.id, newStatus);
      success(
        newStatus
          ? `"${wallpaper.title || 'Wallpaper'}" is now the Featured Hero on the mobile app!`
          : `Removed "${wallpaper.title || 'Wallpaper'}" from Featured Hero.`
      );
      setWallpapers((prev) =>
        prev.map((wp) => {
          if (wp.id === wallpaper.id) {
            return { ...wp, isFeatured: newStatus };
          }
          if (newStatus && wp.isFeatured) {
            return { ...wp, isFeatured: false };
          }
          return wp;
        })
      );
      if (inspectingWallpaper?.id === wallpaper.id) {
        setInspectingWallpaper((prev) =>
          prev ? { ...prev, isFeatured: newStatus } : prev
        );
      }
    } catch (err) {
      console.error("Failed to toggle featured status:", err);
      error(err.message || "Failed to update Featured status.");
      throw err;
    }
  };

  const handleSaveInspector = async (docId, updates) => {
    try {
      if (updates.isFeatured !== undefined) {
        await setFeaturedWallpaper(docId, updates.isFeatured);
      }
      const { isFeatured, ...docUpdates } = updates;
      if (Object.keys(docUpdates).length > 0) {
        await updateWallpaperDoc(docId, docUpdates);
      }
      success("Wallpaper updated in Firestore.");
      setWallpapers((prev) =>
        prev.map((wp) => {
          if (wp.id === docId) {
            return { ...wp, ...updates };
          }
          if (updates.isFeatured && wp.isFeatured) {
            return { ...wp, isFeatured: false };
          }
          return wp;
        })
      );
      setInspectingWallpaper((prev) =>
        prev && prev.id === docId ? { ...prev, ...updates } : prev
      );
    } catch (err) {
      console.error("Failed to save inspector updates:", err);
      error(err.message || "Failed to update wallpaper.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingWallpaper) return;
    setDeleteLoading(true);
    try {
      await deleteWallpaperDoc(deletingWallpaper.id);
      success("Wallpaper document deleted from Firestore.");
      setWallpapers((prev) => prev.filter((wp) => wp.id !== deletingWallpaper.id));
      if (inspectingWallpaper?.id === deletingWallpaper.id) {
        setInspectingWallpaper(null);
      }
      setDeletingWallpaper(null);
    } catch (err) {
      error(err.message || "Failed to delete wallpaper.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Bulk Delete Selected
  const handleBulkDelete = async () => {
    if (selectedDocIds.size === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${selectedDocIds.size} selected wallpapers from Firestore?`
      )
    ) {
      return;
    }

    let deleted = 0;
    for (const id of Array.from(selectedDocIds)) {
      try {
        await deleteWallpaperDoc(id);
        deleted++;
      } catch (e) {
        console.error(e);
      }
    }
    success(`Deleted ${deleted} wallpapers from Firestore.`);
    setSelectedDocIds(new Set());
    loadWallpapers();
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1720px] mx-auto space-y-6 w-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A374A] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#dce3f0] tracking-tight">
              Wallpaper Library
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#192029] text-[#c0c1ff] font-mono text-xs border border-[#2A374A]">
              {totalItems} Assets
            </span>
          </div>
          <p className="text-xs lg:text-sm text-[#908fa0]">
            Browse, filter, edit metadata, and inspect Firestore & Cloudinary synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {selectedDocIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#93000a]/20 hover:bg-[#93000a]/40 border border-[#ef4444] text-[#ffb4ab] text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedDocIds.size})</span>
            </button>
          )}

          <button
            onClick={loadWallpapers}
            disabled={loading}
            className="p-2 rounded-lg bg-[#192029] hover:bg-[#232a34] border border-[#2A374A] text-[#dce3f0] transition-colors"
            title="Refresh Library"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold shadow-lg shadow-[#6366f1]/25 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Upload New</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search, Category Filter, Sort, View Switcher */}
      <section className="bg-[#192029] border border-[#2A374A] rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[280px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#908fa0] pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search wallpapers by title, category, or file ID..."
              className="w-full pl-9 pr-4 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] placeholder-[#908fa0] text-xs focus:outline-none focus:border-[#6366f1]"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-xs text-[#dce3f0] focus:outline-none focus:border-[#6366f1] cursor-pointer"
            >
              <option value="all">All Categories ({dynamicCategories.length})</option>
              {dynamicCategories.map((catKey) => (
                <option key={catKey} value={catKey}>
                  {getCategoryDisplayName(catKey)}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-xs text-[#dce3f0] focus:outline-none focus:border-[#6366f1] cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="category">Sort: By Category</option>
            </select>

            {/* View Switcher */}
            <div className="flex items-center bg-[#151c25] border border-[#2A374A] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded ${
                  viewMode === "grid"
                    ? "bg-[#232a34] text-[#c0c1ff]"
                    : "text-[#908fa0] hover:text-[#dce3f0]"
                }`}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${
                  viewMode === "list"
                    ? "bg-[#232a34] text-[#c0c1ff]"
                    : "text-[#908fa0] hover:text-[#dce3f0]"
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Selection Bar if multiple items selected */}
        {selectedDocIds.size > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#2A374A]/60 text-xs font-mono text-[#c0c1ff]">
            <span>{selectedDocIds.size} wallpaper(s) selected</span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllOnPage}
                className="hover:underline text-[#4cd7f6]"
              >
                Select all on page
              </button>
              <span>•</span>
              <button
                onClick={clearSelection}
                className="hover:underline text-[#908fa0]"
              >
                Deselect all
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Wallpaper Grid / List */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#6366f1] animate-spin" />
          <span className="font-mono text-xs text-[#908fa0]">
            Fetching 598+ wallpapers from Firestore...
          </span>
        </div>
      ) : paginatedWallpapers.length === 0 ? (
        <div className="p-16 rounded-2xl bg-[#192029] border border-[#2A374A] text-center space-y-3">
          <Search className="w-8 h-8 text-[#908fa0] mx-auto opacity-50" />
          <h3 className="font-bold text-sm text-[#dce3f0]">No wallpapers match criteria</h3>
          <p className="text-xs text-[#908fa0] max-w-sm mx-auto">
            Try adjusting your search query or selecting "All Categories" from the filter.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {paginatedWallpapers.map((wp) => (
            <WallpaperCard
              key={wp.id}
              wallpaper={wp}
              selected={selectedDocIds.has(wp.id)}
              onSelect={toggleSelect}
              onInspect={(w) => setInspectingWallpaper(w)}
              onEdit={(w) => setInspectingWallpaper(w)}
              onDelete={(w) => setDeletingWallpaper(w)}
              onToggleFeatured={handleToggleFeatured}
            />
          ))}
        </section>
      ) : (
        /* List View */
        <section className="p-4 rounded-xl bg-[#192029] border border-[#2A374A] overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-[#2A374A] text-[#908fa0] uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Preview</th>
                <th className="py-2.5 px-3">Title & Filename</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Doc ID</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A374A]/40">
              {paginatedWallpapers.map((wp) => (
                <tr key={wp.id} className="hover:bg-[#151c25]/60 transition-colors">
                  <td className="py-2 px-3">
                    <div className="w-9 h-14 rounded bg-black overflow-hidden border border-[#2A374A]">
                      <img
                        src={wp.imageUrl}
                        alt={wp.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-3 font-sans">
                    <span className="font-semibold text-xs text-[#dce3f0] block truncate max-w-xs">
                      {wp.title || wp.filename || "Wallpaper"}
                    </span>
                    <span className="text-[10px] font-mono text-[#908fa0]">
                      {wp.format?.toUpperCase() || "WEBP"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded bg-[#232a34] text-[#4cd7f6] text-[11px]">
                      {getCategoryDisplayName(wp.category)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[#c0c1ff]">
                    {wp.id.substring(0, 10)}...
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-[#00885d]/20 text-[#4edea3] text-[10px]">
                      Live
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleToggleFeatured(wp)}
                        className={`p-1.5 rounded transition-colors ${
                          wp.isFeatured
                            ? "bg-[#eab308]/20 text-[#facc15]"
                            : "bg-[#232a34] text-[#908fa0] hover:text-[#facc15]"
                        }`}
                        title={wp.isFeatured ? "Featured (Click to unset)" : "Set Featured"}
                      >
                        <Star className={`w-3.5 h-3.5 ${wp.isFeatured ? "fill-[#facc15]" : ""}`} />
                      </button>
                      <button
                        onClick={() => setInspectingWallpaper(wp)}
                        className="p-1.5 rounded bg-[#232a34] text-[#dce3f0] hover:bg-[#2e353f]"
                        title="Inspect"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingWallpaper(wp)}
                        className="p-1.5 rounded bg-[#232a34] text-[#ffb4ab] hover:bg-[#93000a]/30"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#2A374A] text-[#908fa0] text-xs font-mono">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} -{" "}
            {Math.min(currentPage * pageSize, totalItems)} of {totalItems} wallpapers
          </span>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-[#192029] border border-[#2A374A] text-[#dce3f0] disabled:opacity-40 hover:bg-[#232a34]"
            >
              Previous
            </button>

            <span className="px-3 py-1.5 rounded-lg bg-[#6366f1] text-white font-bold">
              {currentPage}
            </span>

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-[#192029] border border-[#2A374A] text-[#dce3f0] disabled:opacity-40 hover:bg-[#232a34]"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Slide-out Inspector Drawer */}
      {inspectingWallpaper && (
        <WallpaperInspector
          wallpaper={inspectingWallpaper}
          categories={allCategories}
          onClose={() => setInspectingWallpaper(null)}
          onSaveCategory={handleSaveInspector}
          onDelete={(w) => setDeletingWallpaper(w)}
          onToggleFeatured={handleToggleFeatured}
        />
      )}

      {/* Delete Confirmation Modal */}
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
