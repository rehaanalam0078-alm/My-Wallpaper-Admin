import { AlertTriangle, Trash2 } from "lucide-react";

export default function DeleteModal({
  isOpen,
  wallpaper = null,
  title = null,
  description = null,
  confirmLabel = null,
  itemName = null,
  onClose,
  onConfirm,
  loading = false
}) {
  if (!isOpen) return null;

  const resolvedName =
    itemName ||
    wallpaper?.title ||
    wallpaper?.filename ||
    (wallpaper?.id ? `wp_${wallpaper.id.substring(0, 8)}` : "item");

  const modalTitle = title || (wallpaper ? "Delete this wallpaper?" : "Confirm Deletion");
  const actionText = confirmLabel || (wallpaper ? "Delete Wallpaper" : "Delete");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080f17]/80 backdrop-blur-md animate-fade-in">
      {/* Modal Card */}
      <div className="w-full max-w-lg bg-[#192029] border border-[#2A374A] rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Warning Banner */}
        <div className="p-6 border-b border-[#2A374A] flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#93000a]/30 border border-[#ef4444]/40 text-[#ffb4ab] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#dce3f0] leading-tight">
              {modalTitle}
            </h3>
            <span className="font-mono text-xs text-[#ffb4ab] tracking-wider uppercase block">
              Destructive Operation • Permanent
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {description ? (
            <p className="text-sm text-[#c7c4d7] leading-relaxed">
              {description}
            </p>
          ) : (
            <p className="text-sm text-[#c7c4d7] leading-relaxed">
              This will permanently remove{" "}
              <code className="px-1.5 py-0.5 rounded bg-[#232a34] text-[#c0c1ff] font-mono text-xs">
                {resolvedName}
              </code>{" "}
              from the Firestore database.
            </p>
          )}

          {/* Impact Callout */}
          {wallpaper && (
            <div className="p-3.5 rounded-xl bg-[#151c25] border border-[#2A374A]/80 space-y-2">
              <div className="flex items-center gap-2 text-[#dce3f0] text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#4cd7f6]" />
                <span>Immediate Infrastructure Impact:</span>
              </div>
              <ul className="text-xs text-[#908fa0] space-y-1 list-disc list-inside">
                <li>Asset removed from Firestore queries and Android client feeds.</li>
                <li>Doc ID: {wallpaper.id} will be permanently removed.</li>
                <li>Cloudinary image remains in CDN storage unless purged.</li>
              </ul>
            </div>
          )}

          <p className="text-xs text-[#dce3f0] font-medium">
            This action cannot be undone. Are you absolutely certain?
          </p>
        </div>

        {/* Footer CTAs */}
        <div className="p-4 bg-[#232a34] border-t border-[#2A374A] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#192029] border border-[#2A374A] text-[#dce3f0] hover:bg-[#2e353f] text-xs font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#ef4444] text-white text-xs font-medium hover:brightness-110 flex items-center gap-1.5 transition-all shadow-lg shadow-[#ef4444]/20 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{loading ? "Deleting..." : actionText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
