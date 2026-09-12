import { useState } from "react";
import { Eye, Edit3, Trash2, Check, ExternalLink, Star } from "lucide-react";
import { getCategoryDisplayName } from "../services/categoryNormalizer";

export default function WallpaperCard({
  wallpaper,
  onInspect,
  onEdit,
  onDelete,
  selected,
  onSelect,
  onToggleFeatured
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const displayName = wallpaper.title || wallpaper.filename || "Wallpaper";
  const categoryLabel = getCategoryDisplayName(wallpaper.category);
  const resolution = wallpaper.width && wallpaper.height
    ? `${wallpaper.width} x ${wallpaper.height}`
    : "Portrait HD";

  return (
    <article
      className={`group relative bg-[#192029] rounded-xl border transition-all duration-200 overflow-hidden flex flex-col shadow-lg hover:shadow-2xl hover:border-[#6366f1]/60 ${
        selected ? "border-[#6366f1] ring-2 ring-[#6366f1]/40" : "border-[#2A374A]"
      }`}
    >
      {/* 9:16 Aspect Ratio Image Frame */}
      <div className="relative aspect-[9/16] bg-[#080f17] overflow-hidden">
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#151c25] animate-pulse">
            <span className="font-mono text-xs text-[#908fa0]">Loading 9:16...</span>
          </div>
        )}

        {imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#151c25] p-4 text-center">
            <span className="text-xs text-[#ffb4ab]">Image unavailable</span>
          </div>
        ) : (
          <img
            src={wallpaper.imageUrl}
            alt={displayName}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Floating Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00885d]/30 text-[#4edea3] border border-[#00885d]/60 font-mono text-[11px] backdrop-blur-md flex items-center gap-1.5 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              Live
            </span>
            {wallpaper.isFeatured && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#eab308]/40 text-[#facc15] border border-[#eab308]/80 font-mono text-[11px] backdrop-blur-md flex items-center gap-1 shadow font-bold">
                <Star className="w-3 h-3 fill-[#facc15]" />
                Featured
              </span>
            )}
          </div>

          {onSelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(wallpaper.id);
              }}
              className={`w-6 h-6 rounded flex items-center justify-center shadow pointer-events-auto transition-colors ${
                selected
                  ? "bg-[#6366f1] text-white"
                  : "bg-[#080f17]/70 border border-[#464554] text-transparent hover:border-[#6366f1]"
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}
        </div>

        {/* Hover Action Overlay Scrim */}
        <div className="absolute inset-0 bg-[#080f17]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4 gap-2">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFeatured && onToggleFeatured(wallpaper);
              }}
              className={`p-2.5 rounded-lg border transition-colors ${
                wallpaper.isFeatured
                  ? "bg-[#eab308]/20 border-[#eab308] text-[#facc15] hover:bg-[#eab308]/30"
                  : "bg-[#232a34] border-[#2A374A] text-[#908fa0] hover:text-[#facc15] hover:border-[#eab308]/50"
              }`}
              title={wallpaper.isFeatured ? "Featured Hero (Click to unset)" : "Set as Featured Hero on App"}
            >
              <Star className={`w-4 h-4 ${wallpaper.isFeatured ? "fill-[#facc15]" : ""}`} />
            </button>
            <button
              onClick={() => onInspect && onInspect(wallpaper)}
              className="p-2.5 rounded-lg bg-[#232a34] border border-[#2A374A] text-[#dce3f0] hover:bg-[#2e353f] hover:text-white transition-colors"
              title="Inspect Wallpaper"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit && onEdit(wallpaper)}
              className="p-2.5 rounded-lg bg-[#232a34] border border-[#2A374A] text-[#c0c1ff] hover:bg-[#2e353f] hover:text-[#8083ff] transition-colors"
              title="Edit Category"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete && onDelete(wallpaper)}
              className="p-2.5 rounded-lg bg-[#93000a]/20 border border-[#ffb4ab]/40 text-[#ffb4ab] hover:bg-[#93000a]/50 hover:text-white transition-colors"
              title="Delete Wallpaper"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Card Content Footer */}
      <div className="p-3.5 flex flex-col gap-1.5 bg-[#192029]">
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 rounded bg-[#232a34] text-[#4cd7f6] border border-[#2A374A] font-mono text-[11px]">
            {categoryLabel}
          </span>
          <span className="font-mono text-[11px] text-[#908fa0]">
            {resolution}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-[#dce3f0] truncate" title={displayName}>
          {displayName}
        </h3>

        <div className="flex items-center justify-between pt-1 border-t border-[#2A374A]/60 font-mono text-[10px] text-[#908fa0]">
          <span className="truncate max-w-[120px]">
            ID: {wallpaper.id.substring(0, 10)}...
          </span>
          <a
            href={wallpaper.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#4cd7f6] flex items-center gap-0.5"
            title="Open raw image"
          >
            CDN <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
