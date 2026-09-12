import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderPlus,
  ArrowRight,
  Trash2,
  Image,
  RefreshCw,
  Edit3
} from "lucide-react";
import CategoryModal from "../components/CategoryModal";
import DeleteModal from "../components/DeleteModal";
import {
  fetchCategories,
  createCategory,
  renameCategory,
  deleteCategory
} from "../services/firestoreService";
import { useToast } from "../context/ToastContext";

export default function Categories() {
  const navigate = useNavigate();
  const { success, error, warning } = useToast();

  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCategories();
      setCategoriesList(data);
    } catch (err) {
      error(err.message || "Could not fetch categories from Firestore.");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create Category handler with strict Firestore persistence
  const handleCreateCategory = async (rawName) => {
    try {
      const created = await createCategory(rawName);
      await loadData();
      success(`Category "${created.displayName}" created successfully in Firestore.`);
    } catch (err) {
      error(err.message || "Failed to create category in Firestore.");
      throw err;
    }
  };

  // Rename Category handler with batched wallpaper updates
  const handleRenameCategory = async (newRawName) => {
    if (!renamingCategory) return;
    try {
      const res = await renameCategory(renamingCategory.key, newRawName);
      await loadData();
      success(
        `Category renamed to "${res.displayName}" (${res.updatedWallpapersCount} wallpapers updated).`
      );
      setRenamingCategory(null);
    } catch (err) {
      error(err.message || "Failed to rename category in Firestore.");
      throw err;
    }
  };

  // Delete Category handler with safety verification
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    if (deletingCategory.count > 0) {
      warning(
        `Cannot delete "${deletingCategory.displayName}" because it contains ${deletingCategory.count} wallpapers. Reassign or delete wallpapers first.`
      );
      setDeletingCategory(null);
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteCategory(deletingCategory.key);
      await loadData();
      success(`Category "${deletingCategory.displayName}" removed from Firestore.`);
      setDeletingCategory(null);
    } catch (err) {
      error(err.message || "Failed to delete category.");
    } finally {
      setDeleteLoading(false);
    }
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
            Persistent Firestore taxonomy with live wallpaper counts, batched renames, and Android app synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg bg-[#192029] hover:bg-[#232a34] border border-[#2A374A] text-[#dce3f0] transition-colors"
            title="Refresh from Firestore"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
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
            Synchronizing categories with Firestore...
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
                    <span className="font-mono text-xs">No wallpapers yet</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#192029] via-transparent to-black/40" />

                {/* Top Badge: Canonical Key */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[#4cd7f6] border border-white/10 font-mono text-[10px]">
                    id: {cat.key}
                  </span>
                  {cat.isPersistent && (
                    <span className="px-1.5 py-0.5 rounded bg-[#00885d]/30 text-[#4edea3] border border-[#4edea3]/30 font-mono text-[9px]">
                      Firestore Doc
                    </span>
                  )}
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
                    onClick={() => navigate(`/categories/${cat.key}`)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-xs font-semibold text-[#dce3f0] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#6366f1]" />
                  </button>

                  <button
                    onClick={() => setRenamingCategory(cat)}
                    className="p-1.5 rounded-lg bg-[#232a34] hover:bg-[#6366f1]/20 border border-[#2A374A] text-[#908fa0] hover:text-[#c0c1ff] transition-colors"
                    title="Rename Category"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeletingCategory(cat)}
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

      {/* Create Category Modal */}
      <CategoryModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreateCategory}
        title="Create New Category"
        actionLabel="Create in Firestore"
      />

      {/* Rename Category Modal */}
      {renamingCategory && (
        <CategoryModal
          isOpen={!!renamingCategory}
          onClose={() => setRenamingCategory(null)}
          onSave={handleRenameCategory}
          initialName={renamingCategory.displayName}
          title={`Rename Category: ${renamingCategory.displayName}`}
          actionLabel="Save & Update Wallpapers"
          isRename={true}
        />
      )}

      {/* Delete Category Confirmation Modal */}
      {deletingCategory && (
        <DeleteModal
          isOpen={!!deletingCategory}
          onClose={() => setDeletingCategory(null)}
          onConfirm={handleConfirmDelete}
          loading={deleteLoading}
          title={`Delete Category "${deletingCategory.displayName}"`}
          description={
            deletingCategory.count > 0
              ? `Cannot delete this category because it contains ${deletingCategory.count} wallpapers. To protect Android app data integrity, please delete or reassign its wallpapers first.`
              : `Are you sure you want to permanently delete category "${deletingCategory.displayName}" from Firestore? This action cannot be undone.`
          }
        />
      )}
    </div>
  );
}
