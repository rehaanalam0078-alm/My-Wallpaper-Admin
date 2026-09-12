import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FolderPlus,
  Eye,
  X,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  validateImageFile,
  getImageDimensions,
  processBatchUpload
} from "../services/cloudinaryService";
import {
  addWallpaperDoc,
  saveBatchHistory,
  fetchCategories,
  createCategory
} from "../services/firestoreService";
import {
  normalizeCategory,
  getCategoryDisplayName
} from "../services/categoryNormalizer";
import { useToast } from "../context/ToastContext";
import CategoryModal from "../components/CategoryModal";

export default function BulkUpload() {
  const { success, error, warning, info } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Dynamic Categories from Firestore
  const [categories, setCategories] = useState([]);

  // Default Batch Category
  const [defaultCategory, setDefaultCategory] = useState("anime");
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const list = await fetchCategories();
      setCategories(list);
      if (list.length > 0) {
        setDefaultCategory((prev) => {
          if (list.some((c) => c.key === prev)) return prev;
          return list[0].key;
        });
      }
    } catch (err) {
      console.warn("Could not load categories for upload:", err);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Handle + New Category creation directly from Bulk Upload
  const handleCreateCategory = async (trimmedName) => {
    try {
      const created = await createCategory(trimmedName);
      await loadCategories();
      setDefaultCategory(created.key);
      setQueue((prev) =>
        prev.map((i) => (!i.isOverridden ? { ...i, category: created.key } : i))
      );
      success(
        `Category "${created.displayName}" created and selected as batch default.`
      );
    } catch (err) {
      error(err.message || "Failed to create category.");
      throw err;
    }
  };

  // Queue state
  const [queue, setQueue] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);

  // Execution state
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const abortControllerRef = useRef(null);
  const pauseRef = useRef(false);

  // Batch telemetry
  const [batchId, setBatchId] = useState("");
  const [uploadSummary, setUploadSummary] = useState(null);

  // Pagination for queue view
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  // Handle files selected (drag-drop or picker)
  const handleFilesAdded = async (filesList) => {
    if (!filesList || filesList.length === 0) return;

    const newItems = [];
    let rejectedCount = 0;

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const validation = validateImageFile(file);
      if (!validation.valid) {
        rejectedCount++;
        continue;
      }

      const dimensions = await getImageDimensions(file);
      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`,
        file,
        name: file.name,
        size: file.size,
        dimensions,
        category: defaultCategory,
        isOverridden: false,
        status: "pending",
        progress: 0,
        error: null,
        imageUrl: null,
        previewUrl: URL.createObjectURL(file)
      });
    }

    if (rejectedCount > 0) {
      warning(`${rejectedCount} file(s) rejected (unsupported format or >25MB).`);
    }

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
      success(`Added ${newItems.length} wallpaper(s) to the upload queue.`);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Change category override for a specific file
  const handleItemCategoryChange = (id, newCat) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, category: newCat, isOverridden: newCat !== defaultCategory }
          : item
      )
    );
  };

  // Remove individual file from queue
  const handleRemoveItem = (id) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // Clear entire queue
  const handleClearQueue = () => {
    queue.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setQueue([]);
    setUploadSummary(null);
    setPage(1);
    info("Upload queue cleared.");
  };

  // Start Batch Upload
  const startUpload = async () => {
    const pendingItems = queue.filter((i) => i.status === "pending" || i.status === "failed");
    if (pendingItems.length === 0) {
      warning("No pending items in queue to upload.");
      return;
    }

    setIsUploading(true);
    setIsPaused(false);
    pauseRef.current = false;
    const newBatchId = `batch_${Date.now().toString().slice(-4)}`;
    setBatchId(newBatchId);
    abortControllerRef.current = new AbortController();

    // Mark pending items as pending in state
    setQueue((prev) =>
      prev.map((item) =>
        item.status === "failed" ? { ...item, status: "pending", error: null, progress: 0 } : item
      )
    );

    let successCount = 0;
    let failCount = 0;

    try {
      await processBatchUpload({
        items: pendingItems,
        concurrency: 3,
        signal: abortControllerRef.current.signal,
        isPaused: () => pauseRef.current,
        onItemProgress: (itemId, prog) => {
          setQueue((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, progress: prog.percent, status: "uploading" } : i))
          );
        },
        onItemComplete: async (item, cloudinaryRes) => {
          try {
            await addWallpaperDoc({
              imageUrl: cloudinaryRes.secureUrl,
              category: item.category,
              filename: item.name,
              title: item.name.replace(/\.[^/.]+$/, ""),
              publicId: cloudinaryRes.publicId,
              width: cloudinaryRes.width || item.dimensions.width,
              height: cloudinaryRes.height || item.dimensions.height,
              bytes: cloudinaryRes.bytes || item.size,
              format: cloudinaryRes.format || "webp"
            });

            successCount++;
            setQueue((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "success",
                      progress: 100,
                      imageUrl: cloudinaryRes.secureUrl
                    }
                  : i
              )
            );
          } catch (fireErr) {
            failCount++;
            setQueue((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "failed",
                      error: `Cloudinary OK, but Firestore save failed: ${fireErr.message}`
                    }
                  : i
              )
            );
          }
        },
        onItemFail: (item, err) => {
          failCount++;
          setQueue((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "failed", error: err.message || "Upload failed" }
                : i
            )
          );
        }
      });

      // Save batch history to Firestore
      const summary = {
        batchId: newBatchId,
        category: defaultCategory,
        totalFiles: pendingItems.length,
        successCount,
        failCount,
        status: failCount === 0 ? "Published" : "Partial",
        date: new Date().toISOString()
      };
      await saveBatchHistory(summary);
      setUploadSummary(summary);

      if (failCount === 0) {
        success(`All ${successCount} wallpapers uploaded and published to Firestore!`, "Batch Complete");
      } else {
        warning(`${successCount} uploaded, ${failCount} failed. You can retry failed items.`, "Batch Partial");
      }
    } catch (err) {
      error(err.message || "Batch upload interrupted.");
    } finally {
      setIsUploading(false);
    }
  };

  const togglePause = () => {
    pauseRef.current = !isPaused;
    setIsPaused(!isPaused);
  };

  const cancelBatch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    warning("Upload batch cancelled.");
  };

  const retryFailed = () => {
    startUpload();
  };

  // Metrics for UI
  const totalQueued = queue.length;
  const successfulCount = queue.filter((i) => i.status === "success").length;
  const failedCount = queue.filter((i) => i.status === "failed").length;
  const remainingCount = queue.filter((i) => i.status === "pending" || i.status === "uploading").length;
  const estTotalSizeMb = (queue.reduce((acc, i) => acc + i.size, 0) / (1024 * 1024)).toFixed(1);

  const totalPages = Math.ceil(queue.length / itemsPerPage) || 1;
  const paginatedQueue = queue.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="p-6 lg:p-10 max-w-[1720px] mx-auto space-y-6 w-full">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A374A] pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#908fa0] mb-1">
            <span>Studio</span>
            <span>/</span>
            <span>Wallpapers</span>
            <span>/</span>
            <span className="text-[#c0c1ff]">Bulk Upload</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#dce3f0] tracking-tight">
              Bulk Upload Wallpapers
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#192029] border border-[#2A374A] text-xs font-mono text-[#4edea3] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              v2.4 Production Engine
            </span>
          </div>
          <p className="text-xs lg:text-sm text-[#908fa0] mt-1">
            Upload batches of high-resolution wallpapers and assign to Android app collections in seconds.
          </p>
        </div>

        {/* Tab Indicator */}
        <div className="flex items-center bg-[#151c25] border border-[#2A374A] rounded-xl p-1 text-xs font-medium">
          <span className="px-3 py-1.5 rounded-lg bg-[#232a34] text-[#c0c1ff] font-semibold flex items-center gap-1.5">
            Queue ({totalQueued})
          </span>
          <span className="px-3 py-1.5 text-[#908fa0]">
            Completed ({successfulCount})
          </span>
        </div>
      </div>

      {/* Live Upload Progress Section */}
      {(isUploading || uploadSummary || failedCount > 0) && (
        <section className="p-6 rounded-2xl bg-[#192029] border border-[#6366f1]/50 shadow-2xl space-y-5 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#6366f1]/20 text-[#c0c1ff] border border-[#6366f1]/40 font-mono text-xs font-semibold">
                  BATCH {batchId || "#LIVE"}
                </span>
                <h3 className="font-semibold text-sm text-[#dce3f0]">
                  Uploading {getCategoryDisplayName(defaultCategory)} Collection
                </h3>
              </div>
              <p className="text-xs text-[#908fa0] mt-1 font-mono">
                {successfulCount} of {totalQueued} Complete • {remainingCount} in queue
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isUploading && (
                <>
                  <button
                    onClick={togglePause}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-xs font-medium text-[#dce3f0]"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-[#4edea3]" /> : <Pause className="w-3.5 h-3.5 text-[#f59e0b]" />}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </button>
                  <button
                    onClick={cancelBatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#93000a]/20 border border-[#ef4444] hover:bg-[#93000a]/40 text-xs font-medium text-[#ffb4ab]"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </>
              )}

              {failedCount > 0 && !isUploading && (
                <button
                  onClick={retryFailed}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-xs font-medium text-white shadow"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Failed ({failedCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#908fa0]">Pipeline Progress</span>
              <span className="text-[#c0c1ff] font-bold">
                {totalQueued > 0 ? Math.round((successfulCount / totalQueued) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-[#151c25] rounded-full h-2.5 overflow-hidden border border-[#2A374A]">
              <div
                className="bg-gradient-to-r from-[#6366f1] via-[#06b6d4] to-[#4edea3] h-full rounded-full transition-all duration-300"
                style={{
                  width: `${totalQueued > 0 ? (successfulCount / totalQueued) * 100 : 0}%`
                }}
              />
            </div>
          </div>

          {/* 4 Sub-Metric Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3 rounded-xl bg-[#151c25] border border-[#2A374A]">
              <span className="text-[10px] text-[#908fa0] block">SUCCESSFUL</span>
              <span className="text-xl font-bold text-[#4edea3]">{successfulCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#151c25] border border-[#2A374A]">
              <span className="text-[10px] text-[#908fa0] block">FAILED</span>
              <span className={`text-xl font-bold ${failedCount > 0 ? "text-[#ef4444]" : "text-[#908fa0]"}`}>
                {failedCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#151c25] border border-[#2A374A]">
              <span className="text-[10px] text-[#908fa0] block">REMAINING</span>
              <span className="text-xl font-bold text-[#4cd7f6]">{remainingCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#151c25] border border-[#2A374A]">
              <span className="text-[10px] text-[#908fa0] block">THROUGHPUT</span>
              <span className="text-xl font-bold text-[#c0c1ff]">3 Slots</span>
            </div>
          </div>
        </section>
      )}

      {/* Batch Setup Controls Bar */}
      <section className="p-5 rounded-xl bg-[#192029] border border-[#2A374A] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-[#908fa0] uppercase tracking-wider block">
              Default Batch Category
            </span>
            <div className="flex items-center gap-2">
              <select
                value={defaultCategory}
                onChange={(e) => {
                  setDefaultCategory(e.target.value);
                  setQueue((prev) =>
                    prev.map((i) => (!i.isOverridden ? { ...i, category: e.target.value } : i))
                  );
                }}
                className="px-3 py-2 bg-[#151c25] border border-[#2A374A] rounded-lg text-sm text-[#dce3f0] font-medium focus:outline-none focus:border-[#6366f1] cursor-pointer"
              >
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.displayName} {cat.count > 0 ? `(${cat.count})` : ""}
                    </option>
                  ))
                ) : (
                  <option value={defaultCategory}>{getCategoryDisplayName(defaultCategory)}</option>
                )}
              </select>

              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-2 bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] rounded-lg text-xs font-semibold text-[#c0c1ff] hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ New Category</span>
              </button>
            </div>
          </div>

          {totalQueued > 0 && (
            <div className="hidden sm:flex flex-col font-mono text-xs text-[#908fa0] border-l border-[#2A374A] pl-4">
              <span>{totalQueued} Wallpapers queued • Est. {estTotalSizeMb} MB</span>
              <span className="text-[#4edea3]">
                Target: wallpapers/{normalizeCategory(defaultCategory)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {totalQueued > 0 && (
            <button
              onClick={handleClearQueue}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-xs font-medium text-[#dce3f0] hover:text-white transition-colors disabled:opacity-50"
            >
              Clear Queue
            </button>
          )}

          <button
            onClick={startUpload}
            disabled={isUploading || totalQueued === 0}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#6366f1]/25 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>
              {isUploading
                ? "Processing Batch..."
                : `Start Upload (${totalQueued} Wallpapers)`}
            </span>
          </button>
        </div>
      </section>

      {/* Drag and Drop Zone */}
      <section
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="p-10 lg:p-14 rounded-2xl border-2 border-dashed border-[#2A374A] hover:border-[#6366f1] bg-[#151c25]/50 hover:bg-[#151c25] flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          ref={fileInputRef}
          onChange={(e) => handleFilesAdded(e.target.files)}
          className="hidden"
        />

        <div className="w-16 h-16 rounded-2xl bg-[#232a34] border border-[#2A374A] flex items-center justify-center text-[#c0c1ff] group-hover:scale-110 group-hover:border-[#6366f1] transition-all shadow-inner mb-4">
          <UploadCloud className="w-8 h-8 text-[#6366f1]" />
        </div>

        <h3 className="text-base lg:text-lg font-bold text-[#dce3f0] tracking-tight">
          Drag & drop high-resolution wallpapers here
        </h3>
        <p className="text-xs text-[#908fa0] mt-1">
          or <span className="text-[#c0c1ff] font-semibold underline underline-offset-2">Browse Files</span> from your workstation
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 font-mono text-[11px] text-[#908fa0]">
          <span className="px-2 py-0.5 rounded bg-[#192029] border border-[#2A374A]">
            Supported: JPG, PNG, WEBP up to 25MB
          </span>
          <span className="px-2 py-0.5 rounded bg-[#192029] border border-[#2A374A]">
            Batch limit: up to 500 images
          </span>
          <span className="px-2 py-0.5 rounded bg-[#00885d]/20 text-[#4edea3] border border-[#00885d]/40">
            Native 9:16 Portrait Optimized
          </span>
        </div>
      </section>

      {/* Selected Files Queue Table */}
      {queue.length > 0 && (
        <section className="p-5 rounded-xl bg-[#192029] border border-[#2A374A] space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A374A] pb-3">
            <div className="flex items-center gap-2.5">
              <h3 className="font-semibold text-sm text-[#dce3f0]">
                Selected Files Queue
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[#232a34] border border-[#2A374A] font-mono text-xs text-[#c0c1ff]">
                {totalQueued} items staging
              </span>
            </div>

            <span className="text-xs text-[#908fa0]">
              You can override category individually per image before starting.
            </span>
          </div>

          {/* Queue Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#2A374A] text-[#908fa0] uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Preview</th>
                  <th className="py-2.5 px-3">File Details & Resolution</th>
                  <th className="py-2.5 px-3">Assigned Category (Override)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A374A]/40 font-mono">
                {paginatedQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-[#151c25]/60 transition-colors">
                    {/* Thumbnail */}
                    <td className="py-2.5 px-3">
                      <div className="w-12 h-16 rounded-lg bg-black border border-[#2A374A] overflow-hidden">
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>

                    {/* File Details */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <p className="font-sans font-medium text-xs text-[#dce3f0] truncate max-w-xs" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#908fa0]">
                          <span>
                            {item.dimensions?.width && item.dimensions?.height
                              ? `${item.dimensions.width} x ${item.dimensions.height}`
                              : "9:16 HD"}
                          </span>
                          <span>•</span>
                          <span>{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                        </div>
                      </div>
                    </td>

                    {/* Category Override Dropdown */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <select
                          disabled={isUploading || item.status === "success"}
                          value={item.category}
                          onChange={(e) => handleItemCategoryChange(item.id, e.target.value)}
                          className={`px-2.5 py-1.5 rounded bg-[#151c25] border text-xs focus:outline-none focus:border-[#6366f1] cursor-pointer ${
                            item.isOverridden
                              ? "border-[#4cd7f6] text-[#4cd7f6]"
                              : "border-[#2A374A] text-[#dce3f0]"
                          }`}
                        >
                          {categories.length > 0 ? (
                            categories.map((cat) => (
                              <option key={cat.key} value={cat.key}>
                                {cat.displayName} {cat.key === defaultCategory ? "(Default)" : ""}
                              </option>
                            ))
                          ) : (
                            <option value={item.category}>{getCategoryDisplayName(item.category)}</option>
                          )}
                        </select>
                        {item.isOverridden && (
                          <span className="text-[10px] text-[#4cd7f6]">Overridden</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      {item.status === "pending" && (
                        <span className="px-2 py-0.5 rounded bg-[#232a34] text-[#908fa0] text-[11px]">
                          Pending
                        </span>
                      )}
                      {item.status === "uploading" && (
                        <div className="space-y-1 min-w-[100px]">
                          <span className="text-[11px] text-[#c0c1ff]">
                            Uploading {item.progress}%
                          </span>
                          <div className="w-full bg-[#151c25] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#6366f1] h-full rounded-full"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {item.status === "success" && (
                        <span className="px-2 py-0.5 rounded bg-[#00885d]/20 text-[#4edea3] text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Published
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span className="px-2 py-0.5 rounded bg-[#93000a]/20 text-[#ffb4ab] text-[11px]" title={item.error}>
                          Failed
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="p-1.5 rounded bg-[#232a34] text-[#dce3f0] hover:bg-[#2e353f]"
                          title="Preview Image"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isUploading}
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded bg-[#232a34] text-[#ffb4ab] hover:bg-[#93000a]/30 disabled:opacity-50"
                          title="Remove File"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-[#2A374A] font-mono text-xs text-[#908fa0]">
              <span>
                Showing {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, queue.length)} of {queue.length} files
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded bg-[#232a34] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded bg-[#232a34] disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Floating Complete Bottom Drawer */}
      {uploadSummary && (
        <div className="fixed bottom-6 inset-x-6 lg:left-72 max-w-4xl mx-auto z-40 p-4 rounded-2xl bg-[#192029]/95 border border-[#6366f1] shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00885d]/30 text-[#4edea3] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#dce3f0]">
                Batch Upload Complete
              </h4>
              <p className="text-xs text-[#908fa0] font-mono">
                {uploadSummary.successCount} Wallpapers Ready for Android App •{" "}
                {uploadSummary.failCount} Failed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                handleClearQueue();
              }}
              className="px-4 py-2 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-xs font-medium text-[#dce3f0]"
            >
              Upload Another Batch
            </button>
            <button
              onClick={() => navigate("/wallpapers")}
              className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-xs font-semibold text-white shadow"
            >
              View in Wallpaper Library
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal for queued image */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative max-w-md w-full bg-[#192029] border border-[#2A374A] rounded-2xl overflow-hidden p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A374A] mb-3">
              <span className="font-semibold text-xs text-[#dce3f0] truncate">
                {previewItem.name}
              </span>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded text-[#908fa0] hover:text-[#dce3f0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden">
              <img
                src={previewItem.previewUrl}
                alt={previewItem.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {/* Create New Category Modal */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleCreateCategory}
        title="Create New Category"
        actionLabel="Create & Select Category"
      />
    </div>
  );
}
