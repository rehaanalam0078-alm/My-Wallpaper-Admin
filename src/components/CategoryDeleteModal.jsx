import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Trash2, ArrowRight, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

export default function CategoryDeleteModal({
  isOpen,
  category,
  allCategories = [],
  onClose,
  onConfirm,
  loading
}) {
  const [deleteMode, setDeleteMode] = useState("reassign"); // 'reassign' | 'cascade'
  const [targetCategory, setTargetCategory] = useState("");
  const [confirmCascade, setConfirmCascade] = useState(false);
  const [progress, setProgress] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const otherCategories = useMemo(
    () =>
      allCategories.filter(
        (c) => c.key !== category?.key && c.key !== "uncategorized"
      ),
    [allCategories, category?.key]
  );

  useEffect(() => {
    if (isOpen && category) {
      setDeleteMode("reassign");
      setConfirmCascade(false);
      setProgress(null);
      setErrorMsg("");
      // Pick first available category for reassignment
      if (otherCategories.length > 0) {
        setTargetCategory(otherCategories[0].key);
      } else {
        setTargetCategory("");
      }
    }
  }, [isOpen, category, otherCategories]);

  if (!isOpen || !category) return null;

  const count = category.count || 0;
  const isZeroCount = count === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isZeroCount) {
      if (deleteMode === "reassign") {
        if (!targetCategory) {
          setErrorMsg("Please select a target category to reassign wallpapers to.");
          return;
        }
      } else if (deleteMode === "cascade") {
        if (!confirmCascade) {
          setErrorMsg("Please acknowledge the checkbox to confirm cascade deletion.");
          return;
        }
      }
    }

    try {
      await onConfirm({
        categoryKey: category.key,
        cascadeDeleteWallpapers: !isZeroCount && deleteMode === "cascade",
        reassignToCategory: !isZeroCount && deleteMode === "reassign" ? targetCategory : null,
        onProgress: (prog) => setProgress(prog)
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to delete category.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080f17]/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#192029] border border-[#2A374A] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#2A374A] flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#93000a]/30 border border-[#ef4444]/40 text-[#ffb4ab] flex items-center justify-center shrink-0">
            {isZeroCount ? (
              <Trash2 className="w-6 h-6 text-[#ef4444]" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#dce3f0] leading-tight">
              Delete Category &ldquo;{category.displayName}&rdquo;
            </h3>
            <span className="font-mono text-xs text-[#ffb4ab] tracking-wider uppercase block">
              {isZeroCount ? "0 Wallpapers • Safe Removal" : `${count} Active Wallpapers Affected`}
            </span>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {isZeroCount ? (
            <div className="space-y-3">
              <p className="text-sm text-[#c7c4d7] leading-relaxed">
                Category <span className="font-bold text-white">&ldquo;{category.displayName}&rdquo;</span> contains no wallpapers. Deleting it will permanently remove it from Firestore.
              </p>
              <div className="p-3.5 rounded-xl bg-[#151c25] border border-[#2A374A] text-xs text-[#908fa0] space-y-1">
                <p className="text-[#4edea3] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                  Zero-Impact Operation: No wallpapers will be lost or modified.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#c7c4d7] leading-relaxed">
                This category contains <span className="font-bold text-[#c0c1ff]">{count} wallpapers</span>. Select how you want to handle them before deleting:
              </p>

              {/* Mode 1: Reassign */}
              <div
                onClick={() => setDeleteMode("reassign")}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  deleteMode === "reassign"
                    ? "bg-[#6366f1]/10 border-[#6366f1]"
                    : "bg-[#151c25] border-[#2A374A] hover:border-[#6366f1]/50"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="reassign"
                    checked={deleteMode === "reassign"}
                    onChange={() => setDeleteMode("reassign")}
                    disabled={loading}
                    className="mt-1 accent-[#6366f1]"
                  />
                  <div className="space-y-2 flex-1">
                    <div>
                      <div className="font-semibold text-xs text-[#dce3f0]">
                        Reassign all {count} wallpapers (Recommended)
                      </div>
                      <p className="text-[11px] text-[#908fa0]">
                        Moves all wallpapers safely to another category, preserving them for mobile app users.
                      </p>
                    </div>

                    {deleteMode === "reassign" && (
                      <div className="pt-2">
                        <label className="text-[11px] font-medium text-[#c7c4d7] block mb-1">
                          Transfer wallpapers to:
                        </label>
                        <select
                          value={targetCategory}
                          onChange={(e) => setTargetCategory(e.target.value)}
                          disabled={loading}
                          className="w-full px-3 py-2 bg-[#192029] border border-[#2A374A] rounded-lg text-xs text-[#dce3f0] focus:outline-none focus:border-[#6366f1]"
                        >
                          {otherCategories.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.displayName} ({c.count} wallpapers)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Mode 2: Cascade Delete */}
              <div
                onClick={() => setDeleteMode("cascade")}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  deleteMode === "cascade"
                    ? "bg-[#93000a]/15 border-[#ef4444]"
                    : "bg-[#151c25] border-[#2A374A] hover:border-[#ef4444]/40"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="cascade"
                    checked={deleteMode === "cascade"}
                    onChange={() => setDeleteMode("cascade")}
                    disabled={loading}
                    className="mt-1 accent-[#ef4444]"
                  />
                  <div className="space-y-2 flex-1">
                    <div>
                      <div className="font-semibold text-xs text-[#ffb4ab] flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#ef4444]" />
                        Cascade Delete (Permanently delete category &amp; all {count} wallpapers)
                      </div>
                      <p className="text-[11px] text-[#908fa0]">
                        All {count} wallpaper documents will be deleted from Firestore and immediately removed from mobile apps.
                      </p>
                    </div>

                    {deleteMode === "cascade" && (
                      <div className="pt-2">
                        <label className="flex items-center gap-2 text-xs text-[#ffb4ab] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmCascade}
                            onChange={(e) => setConfirmCascade(e.target.checked)}
                            disabled={loading}
                            className="accent-[#ef4444] rounded"
                          />
                          <span>I confirm deleting {count} wallpapers permanently from Firestore</span>
                        </label>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Progress Bar during execution */}
          {loading && progress && (
            <div className="p-3.5 rounded-xl bg-[#151c25] border border-[#2A374A] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#908fa0] capitalize">
                  {progress.action === "reassigning" ? "Reassigning Wallpapers..." : "Deleting Wallpapers..."}
                </span>
                <span className="text-[#c0c1ff] font-bold">
                  {progress.completed} / {progress.total} ({progress.percent}%)
                </span>
              </div>
              <div className="w-full bg-[#192029] rounded-full h-2 overflow-hidden border border-[#2A374A]">
                <div
                  className="bg-[#6366f1] h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#93000a]/20 border border-[#ef4444]/40 text-[#ffb4ab] text-xs">
              {errorMsg}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#2A374A] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#192029] border border-[#2A374A] text-[#dce3f0] hover:bg-[#2e353f] text-xs font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!isZeroCount && deleteMode === "cascade" && !confirmCascade)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow disabled:opacity-50 ${
                !isZeroCount && deleteMode === "reassign"
                  ? "bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-[#6366f1]/20"
                  : "bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-[#ef4444]/20"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isZeroCount ? (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Category</span>
                </>
              ) : deleteMode === "reassign" ? (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Reassign &amp; Delete Category</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Delete Category &amp; Wallpapers</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
