import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderPlus,
  ArrowRight,
  Trash2,
  Image,
  RefreshCw
} from "lucide-react";
import CategoryModal from "../components/CategoryModal";
import { fetchAllWallpapers } from "../services/firestoreService";
import {
  DEFAULT_CATEGORIES,
  normalizeCategory,
  getCategoryDisplayName
} from "../services/categoryNormalizer";
import { useToast } from "../context/ToastContext";

export default function Categories() {
  const navigate = useNavigate();
  const { success, error, warning } = useToast();

  const [wallpapers, setWallpapers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Custom added categories state
  const [customCategories, setCustomCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllWallpapers();
      setWallpapers(data);
    } catch {
      error("Could not fetch categories from Firestore.");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute category map with count and preview thumbnail
  const categoriesList = useMemo(() => {
    const map = new Map();

    // Initialize with default canonical categories
    DEFAULT_CATEGORIES.forEach((cat) => {
      map.set(cat.id, {
        key: cat.id,
        displayName: cat.name,
        count: 0,
        thumbnailUrl: null
      });
    });

    // Merge custom categories
    customCategories.forEach((cat) => {
      if (!map.has(cat.key)) {
        map.set(cat.key, {
          key: cat.key,
          displayName: cat.displayName,
          count: 0,
          thumbnailUrl: null
        });
      }
    });

    // Populate counts and thumbnails from real Firestore wallpapers
    wallpapers.forEach((wp) => {
      const normKey = normalizeCategory(wp.category);
      if (!map.has(normKey)) {
        map.set(normKey, {
          key: normKey,
          displayName: getCategoryDisplayName(normKey),
          count: 0,
          thumbnailUrl: null
        });
      }
      const entry = map.get(normKey);
      entry.count++;
      if (!entry.thumbnailUrl && wp.imageUrl) {
        entry.thumbnailUrl = wp.imageUrl;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [wallpapers, customCategories]);

  const handleCreateCategory = (newCat) => {
    const existing = categoriesList.find((c) => c.key === newCat.key);
    if (existing) {
      warning(`Category "${newCat.displayName}" already exists.`);
      return;
    }
    setCustomCategories((prev) => [...prev, newCat]);
    success(`Category "${newCat.displayName}" created.`);
  };

  const handleDeleteCategory = (cat) => {
    if (cat.count > 0) {
      warning(
        `Cannot delete "${cat.displayName}" because it contains ${cat.count} wallpapers. Reassign them first.`
      );
      return;
    }
    setCustomCategories((prev) => prev.filter((c) => c.key !== cat.key));
    success(`Category "${cat.displayName}" removed.`);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1720px] mx-auto space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A374A] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#dce3f0] tracking-tight">
              Categories Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#192029] text-[#4cd7f6] font-mono text-xs border border-[#2A374A]">
              {categoriesList.length} Categories
            </span>
          </div>
          <p className="text-xs lg:text-sm text-[#908fa0]">
            Centralized taxonomy with automatic typo normalization (e.g. "ainme" → "Anime", "hindusim" → "Hinduism").
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg bg-[#192029] hover:bg-[#232a34] border border-[#2A374A] text-[#dce3f0] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold shadow-lg shadow-[#6366f1]/25 transition-all active:scale-[0.98]"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create New Category</span>
          </button>
        </div>
      </div>

      {/* Categories Cards Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#6366f1] animate-spin" />
          <span className="font-mono text-xs text-[#908fa0]">
            Aggregating categories from Firestore...
          </span>
        </div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {categoriesList.map((cat) => (
            <div
              key={cat.key}
              className="group bg-[#192029] border border-[#2A374A] hover:border-[#6366f1]/60 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
            >
              {/* Category Cover Preview */}
              <div className="relative h-40 bg-[#151c25] overflow-hidden">
                {cat.thumbnailUrl ? (
                  <img
                    src={cat.thumbnailUrl}
                    alt={cat.displayName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#908fa0]">
                    <Image className="w-8 h-8 opacity-40" />
                    <span className="font-mono text-xs">No preview</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#192029] via-transparent to-black/40" />

                {/* Top Badge: Canonical Key */}
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[#4cd7f6] border border-white/10 font-mono text-[10px]">
                    key: {cat.key}
                  </span>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-bold text-base text-[#dce3f0]">
                    {cat.displayName}
                  </h3>
                  <span className="font-mono text-xs text-[#c0c1ff] font-semibold">
                    {cat.count} Wallpapers
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#2A374A]/60">
                  <button
                    onClick={() => navigate(`/wallpapers?category=${cat.key}`)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-xs font-semibold text-[#dce3f0] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Open Library</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#6366f1]" />
                  </button>

                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1.5 rounded-lg bg-[#232a34] hover:bg-[#93000a]/20 border border-[#2A374A] text-[#908fa0] hover:text-[#ffb4ab] transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Create / Edit Category Modal */}
      <CategoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateCategory}
      />
    </div>
  );
}
