import { useState, useEffect } from "react";
import { X, Copy, Check, Sliders, Trash2, Save, Smartphone, Star } from "lucide-react";
import { fetchCategories } from "../services/firestoreService";
import { getCategoryDisplayName, normalizeCategory } from "../services/categoryNormalizer";

export default function WallpaperInspector({
  wallpaper,
  categories: propCategories = [],
  onClose,
  onSaveCategory,
  onDelete,
  onToggleFeatured
}) {
  const [category, setCategory] = useState(wallpaper?.category || "anime");
  const [title, setTitle] = useState(wallpaper?.title || wallpaper?.filename || "");
  const [categories, setCategories] = useState(propCategories);
  const [copiedDocId, setCopiedDocId] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFeatured, setIsFeatured] = useState(Boolean(wallpaper?.isFeatured));
  const [togglingFeatured, setTogglingFeatured] = useState(false);

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
    } else {
      fetchCategories()
        .then((cats) => setCategories(cats))
        .catch((err) => console.warn("Could not load inspector categories:", err));
    }
  }, [propCategories]);

  useEffect(() => {
    if (wallpaper) {
      setCategory(normalizeCategory(wallpaper.category) || "anime");
      setTitle(wallpaper.title || wallpaper.filename || "");
      setIsFeatured(Boolean(wallpaper.isFeatured));
    }
  }, [wallpaper]);

  const handleToggleFeatured = async () => {
    if (!onToggleFeatured) return;
    setTogglingFeatured(true);
    try {
      const nextVal = !isFeatured;
      await onToggleFeatured({ ...wallpaper, isFeatured: isFeatured });
      setIsFeatured(nextVal);
    } catch (err) {
      console.error("Inspector toggle error:", err);
    } finally {
      setTogglingFeatured(false);
    }
  };

  if (!wallpaper) return null;

  const copyDocId = () => {
    navigator.clipboard.writeText(wallpaper.id);
    setCopiedDocId(true);
    setTimeout(() => setCopiedDocId(false), 2000);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(wallpaper.imageUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveCategory(wallpaper.id, { category, title, isFeatured });
    } finally {
      setSaving(false);
    }
  };

  const resolution = wallpaper.width && wallpaper.height
    ? `${wallpaper.width} x ${wallpaper.height}`
    : "Portrait HD (4K Compatible)";

  const fileSize = wallpaper.bytes
    ? `${(wallpaper.bytes / (1024 * 1024)).toFixed(2)} MB`
    : "Cloud Optimized";

  return (
    <aside className="fixed top-0 right-0 w-full max-w-[480px] h-screen bg-[#232a34] border-l border-[#2A374A] z-40 shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="h-16 px-6 border-b border-[#2A374A] flex items-center justify-between shrink-0 bg-[#192029]">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-[#c0c1ff]" />
          <h3 className="font-semibold text-sm text-[#dce3f0]">Wallpaper Inspector</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#908fa0] hover:text-[#dce3f0] hover:bg-[#2e353f] transition-colors"
          title="Close Inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* High-Fidelity 9:16 Mockup Frame */}
        <div className="relative w-full max-w-[220px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden border-2 border-[#2A374A] shadow-2xl bg-black">
          <img
            src={wallpaper.imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 rounded-full bg-[#00885d] text-white font-mono text-[10px] font-bold shadow">
              ACTIVE ON APP
            </span>
          </div>
        </div>

        {/* Metadata & Controls */}
        <div className="space-y-4">
          {/* Document ID with Copy */}
          <div className="p-3 rounded-lg bg-[#151c25] border border-[#2A374A] flex items-center justify-between">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="font-mono text-[10px] text-[#908fa0] uppercase tracking-wider">
                Firestore Doc ID
              </span>
              <span className="font-mono text-xs text-[#c0c1ff] font-semibold truncate">
                {wallpaper.id}
              </span>
            </div>
            <button
              onClick={copyDocId}
              className="px-2.5 py-1 rounded bg-[#192029] border border-[#2A374A] text-[#908fa0] hover:text-[#dce3f0] text-xs flex items-center gap-1 shrink-0"
            >
              {copiedDocId ? <Check className="w-3.5 h-3.5 text-[#4edea3]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDocId ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Featured Hero Toggle Card (High-Priority Placement) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            isFeatured
              ? "bg-[#eab308]/15 border-[#eab308] shadow-lg shadow-[#eab308]/10 ring-1 ring-[#eab308]/40"
              : "bg-[#151c25] border-[#2A374A] hover:border-[#464554]"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  isFeatured ? "bg-[#eab308] text-black shadow-md shadow-[#eab308]/40" : "bg-[#192029] text-[#908fa0]"
                }`}>
                  <Star className={`w-4 h-4 ${isFeatured ? "fill-black" : ""}`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#dce3f0]">Home Featured Hero</span>
                    {isFeatured && (
                      <span className="px-1.5 py-0.5 rounded bg-[#eab308] text-black font-mono text-[9px] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#908fa0] block">
                    {isFeatured
                      ? "Currently active top banner on Android app"
                      : "Display as the top banner on mobile app"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleFeatured}
                disabled={togglingFeatured}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isFeatured
                    ? "bg-[#eab308] text-black hover:bg-[#ca8a04] shadow-md shadow-[#eab308]/30 font-bold"
                    : "bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow"
                }`}
              >
                {togglingFeatured ? "Saving..." : isFeatured ? "Featured" : "Set Featured"}
              </button>
            </div>
          </div>

          {/* Editable Asset Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c7c4d7]">Asset Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] text-xs font-mono focus:outline-none focus:border-[#6366f1]"
            />
          </div>

          {/* Editable Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c7c4d7]">Assigned Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] text-xs focus:outline-none focus:border-[#6366f1] cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.displayName}
                </option>
              ))}
              {category && !categories.some((c) => c.key === category) && (
                <option key={category} value={category}>
                  {getCategoryDisplayName(category)}
                </option>
              )}
            </select>
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-lg bg-[#151c25] border border-[#2A374A]">
              <span className="font-mono text-[10px] text-[#908fa0] block">RESOLUTION</span>
              <span className="font-mono text-xs text-[#dce3f0] font-medium">{resolution}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#151c25] border border-[#2A374A]">
              <span className="font-mono text-[10px] text-[#908fa0] block">FORMAT & WEIGHT</span>
              <span className="font-mono text-xs text-[#dce3f0] font-medium">
                {wallpaper.format?.toUpperCase() || "WEBP"} • {fileSize}
              </span>
            </div>
          </div>

          {/* Cloudinary Secure URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#c7c4d7]">
                Cloudinary Delivery URL
              </label>
              <span className="font-mono text-[10px] text-[#4edea3] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" /> Cached
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={wallpaper.imageUrl}
                className="flex-1 px-3 py-1.5 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#908fa0] font-mono text-xs truncate"
              />
              <button
                onClick={copyUrl}
                className="px-3 py-1.5 rounded-lg bg-[#151c25] border border-[#2A374A] hover:bg-[#2e353f] text-[#dce3f0] text-xs flex items-center gap-1 shrink-0"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#4edea3]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy</span>
              </button>
            </div>
          </div>

          {/* App Status */}
          <div className="p-3 rounded-lg bg-[#151c25] border border-[#2A374A] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-[#4edea3]" />
              <div className="flex flex-col">
                <span className="text-xs text-[#dce3f0] font-medium">Published on Android App</span>
                <span className="font-mono text-[10px] text-[#908fa0]">Consumer App Feed Active</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#00885d]/30 border border-[#00885d] text-[#4edea3] font-mono text-xs">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-[#2A374A] bg-[#192029] flex flex-col gap-2 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 px-4 rounded-lg bg-[#6366f1] text-white font-medium text-xs hover:bg-[#4f46e5] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving Changes..." : "Save Changes"}</span>
        </button>

        <button
          onClick={() => onDelete && onDelete(wallpaper)}
          className="w-full py-2 px-4 rounded-lg bg-[#93000a]/20 border border-[#ef4444] text-[#ffb4ab] hover:bg-[#93000a]/40 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Wallpaper</span>
        </button>
      </div>
    </aside>
  );
}
