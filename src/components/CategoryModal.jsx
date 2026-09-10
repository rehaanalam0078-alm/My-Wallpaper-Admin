import { useState } from "react";
import { FolderPlus, X } from "lucide-react";
import { normalizeCategory, getCategoryDisplayName } from "../services/categoryNormalizer";

export default function CategoryModal({
  isOpen,
  onClose,
  onSave,
  initialName = "",
  title = "Create New Category"
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name cannot be empty.");
      return;
    }

    const normalizedKey = normalizeCategory(trimmed);
    if (!normalizedKey) {
      setError("Invalid category name.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onSave({
        rawName: trimmed,
        key: normalizedKey,
        displayName: getCategoryDisplayName(normalizedKey)
      });
      setName("");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080f17]/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#192029] border border-[#2A374A] rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#2A374A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#232a34] border border-[#2A374A] flex items-center justify-center text-[#c0c1ff]">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-[#dce3f0]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#908fa0] hover:text-[#dce3f0] p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c7c4d7]">Category Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g. Cyberpunk, Minimalist, AMOLED"
              className="w-full px-3 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] text-sm focus:outline-none focus:border-[#6366f1]"
            />
            {name.trim() && (
              <p className="font-mono text-[11px] text-[#908fa0]">
                Normalized Key:{" "}
                <span className="text-[#4cd7f6]">{normalizeCategory(name)}</span>
              </p>
            )}
            {error && <p className="text-xs text-[#ffb4ab]">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 rounded-lg bg-[#232a34] border border-[#2A374A] text-[#dce3f0] hover:bg-[#2e353f] text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#4f46e5] text-xs font-medium transition-all shadow-lg disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
