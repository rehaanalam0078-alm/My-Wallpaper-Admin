import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Image as ImageIcon,
  FolderTree,
  UploadCloud,
  HardDrive,
  Sparkles,
  ArrowRight,
  Tag,
  CheckCircle2,
  Clock
} from "lucide-react";
import StatCard from "../components/StatCard";
import WallpaperCard from "../components/WallpaperCard";
import WallpaperInspector from "../components/WallpaperInspector";
import DeleteModal from "../components/DeleteModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  computeDashboardStats,
  deleteWallpaperDoc,
  updateWallpaperDoc,
  fetchBatchHistory
} from "../services/firestoreService";
import { getCategoryDisplayName } from "../services/categoryNormalizer";

export default function Dashboard() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWallpapers: 0,
    activeCategoriesCount: 0,
    uploadedToday: 0,
    categoryCounts: {},
    recentWallpapers: []
  });
  const [batches, setBatches] = useState([]);

  const [selectedWallpaper, setSelectedWallpaper] = useState(null);
  const [deletingWallpaper, setDeletingWallpaper] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await computeDashboardStats();
      setStats(data);
      const hist = await fetchBatchHistory(4);
      setBatches(hist);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      error("Could not fetch real-time Firestore statistics.");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveCategory = async (docId, updates) => {
    try {
      await updateWallpaperDoc(docId, updates);
      success("Wallpaper metadata updated in Firestore.");
      setSelectedWallpaper(null);
      loadData();
    } catch (err) {
      error(err.message || "Failed to update wallpaper.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingWallpaper) return;
    setDeleteLoading(true);
    try {
      await deleteWallpaperDoc(deletingWallpaper.id);
      success("Wallpaper deleted from Firestore.");
      setDeletingWallpaper(null);
      if (selectedWallpaper?.id === deletingWallpaper.id) {
        setSelectedWallpaper(null);
      }
      loadData();
    } catch (err) {
      error(err.message || "Failed to delete wallpaper.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const userName = user?.displayName || user?.email?.split("@")[0] || "Curator";

  // Calculate top categories for the distribution widget
  const categoryEntries = Object.entries(stats.categoryCounts).sort(
    ([, countA], [, countB]) => countB - countA
  );
  const totalCount = stats.totalWallpapers || 1;

  return (
    <div className="p-6 lg:p-10 max-w-[1720px] mx-auto space-y-8 w-full">
      {/* Welcome Banner & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A374A] pb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#dce3f0] tracking-tight">
            Good morning, {userName}
          </h1>
          <p className="text-xs lg:text-sm text-[#908fa0] mt-1">
            Manage wallpapers, uploads and categories from one centralized studio.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate("/categories")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#192029] hover:bg-[#232a34] border border-[#2A374A] text-[#dce3f0] text-xs font-semibold transition-colors"
          >
            <Tag className="w-4 h-4 text-[#c0c1ff]" />
            <span>Manage Tags</span>
          </button>

          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold shadow-lg shadow-[#6366f1]/25 transition-all active:scale-[0.98]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Bulk Upload New Wallpapers</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Total Wallpapers"
          value={loading ? "..." : stats.totalWallpapers.toLocaleString()}
          subtext="Active in Firestore database"
          badgeText="+598 indexed"
          badgeColor="text-[#4edea3]"
          icon={ImageIcon}
          footer={
            <>
              <span>Firestore Collection: wallpapers</span>
              <span className="text-[#4edea3] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live
              </span>
            </>
          }
        />

        <StatCard
          title="Active Categories"
          value={loading ? "..." : stats.activeCategoriesCount}
          subtext="Across normalized client tags"
          icon={FolderTree}
          footer={
            <>
              <span>Canonical aliases unified</span>
              <span className="text-[#4cd7f6]">Auto-synced</span>
            </>
          }
        />

        <StatCard
          title="Uploaded Today"
          value={loading ? "..." : stats.uploadedToday}
          subtext={`${stats.uploadedToday} / 50 daily target`}
          progressPercent={(stats.uploadedToday / 50) * 100}
          icon={UploadCloud}
          footer={
            <>
              <span>Target: 50 wallpapers/day</span>
              <span className="text-[#c0c1ff]">
                {Math.round((stats.uploadedToday / 50) * 100)}%
              </span>
            </>
          }
        />

        <StatCard
          title="Storage CDN"
          value="Cloudinary"
          subtext="Direct edge delivery endpoint"
          badgeText="dghtt3gk6"
          badgeColor="text-[#4cd7f6]"
          icon={HardDrive}
          footer={
            <>
              <span>Preset: wallpaper_upload</span>
              <span className="text-[#4edea3]">Global Edge</span>
            </>
          }
        />
      </section>

      {/* Middle Grid: Recent Activity + Category Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Upload Activity (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#192029] border border-[#2A374A] flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-[#dce3f0]">
                  Recent Upload Activity
                </h3>
                <p className="text-xs text-[#908fa0]">
                  Real-time batch ingestions and Firestore publishing pipeline
                </p>
              </div>
              <button
                onClick={() => navigate("/history")}
                className="text-xs text-[#c0c1ff] hover:text-white flex items-center gap-1 transition-colors"
              >
                <span>View All Logs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {batches.length > 0 ? (
                batches.map((batch, idx) => (
                  <div
                    key={batch.id || idx}
                    className="p-3.5 rounded-lg bg-[#151c25] border border-[#2A374A] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#232a34] flex items-center justify-center text-[#c0c1ff]">
                        <Sparkles className="w-4 h-4 text-[#6366f1]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#dce3f0]">
                            {batch.totalFiles || 0} {getCategoryDisplayName(batch.category)} Wallpapers
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#232a34] text-[10px] font-mono text-[#908fa0]">
                            Batch #{batch.batchId || String(idx + 101)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#00885d]/20 text-[#4edea3] text-[10px] font-mono">
                            {batch.status || "Published"}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#908fa0]">
                          {batch.timestamp ? new Date(batch.timestamp).toLocaleTimeString() : "Just now"} •{" "}
                          {batch.successCount || batch.totalFiles || 0} Successful
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate("/wallpapers")}
                      className="px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-xs font-medium text-[#dce3f0] transition-colors"
                    >
                      View Library
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-lg bg-[#151c25] border border-[#2A374A] text-center space-y-2">
                  <Clock className="w-6 h-6 text-[#908fa0] mx-auto opacity-50" />
                  <p className="text-xs text-[#908fa0]">
                    No recent upload batches. Click "Bulk Upload" to ingest new wallpapers.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#2A374A]/60 flex items-center justify-between text-[11px] text-[#908fa0]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
              Ingestion worker idle • All pipelines clean
            </span>
            <span className="font-mono text-[10px]">Webhooks: Cloudinary OK</span>
          </div>
        </div>

        {/* Category Distribution (1 col) */}
        <div className="p-6 rounded-xl bg-[#192029] border border-[#2A374A] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-[#dce3f0]">
                  Category Distribution
                </h3>
                <p className="text-xs text-[#908fa0]">
                  Live wallpaper breakdown in Firestore
                </p>
              </div>
              <FolderTree className="w-4 h-4 text-[#908fa0]" />
            </div>

            <div className="space-y-3.5">
              {categoryEntries.slice(0, 6).map(([catKey, count]) => {
                const percent = Math.round((count / totalCount) * 100);
                return (
                  <div key={catKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#dce3f0]">
                        {getCategoryDisplayName(catKey)}
                      </span>
                      <span className="font-mono text-[#908fa0]">
                        {percent}% ({count})
                      </span>
                    </div>
                    <div className="w-full bg-[#151c25] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#6366f1] h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => navigate("/categories")}
            className="mt-6 w-full py-2 px-3 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-xs font-medium text-[#c0c1ff] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Detailed Category Analytics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Bottom Section: Recently Added Wallpapers to Android App (Live Mobile Preview) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#dce3f0] tracking-tight">
              Recently Added Wallpapers to Android App
            </h2>
            <p className="text-xs text-[#908fa0]">
              Live mobile preview (9:16 aspect ratio) as displayed on Android client devices
            </p>
          </div>

          <button
            onClick={() => navigate("/wallpapers")}
            className="text-xs font-semibold text-[#c0c1ff] hover:text-white flex items-center gap-1 self-start sm:self-auto transition-colors"
          >
            <span>Explore All 598+ Wallpapers</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 9:16 Mobile Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {stats.recentWallpapers.map((wp) => (
            <WallpaperCard
              key={wp.id}
              wallpaper={wp}
              onInspect={(w) => setSelectedWallpaper(w)}
              onEdit={(w) => setSelectedWallpaper(w)}
              onDelete={(w) => setDeletingWallpaper(w)}
            />
          ))}
        </div>
      </section>

      {/* Footer Sync Telemetry Status Bar */}
      <div className="p-3.5 rounded-xl bg-[#151c25] border border-[#2A374A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#908fa0] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
          <span>Sync status: All Android client devices updated via Firestore listeners.</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Global Latency: <span className="text-[#4edea3]">24ms</span></span>
          <span>Database: <span className="text-[#c0c1ff]">my-wallpaper-c9bf1</span></span>
        </div>
      </div>

      {/* Slide-out Inspector Drawer */}
      {selectedWallpaper && (
        <WallpaperInspector
          wallpaper={selectedWallpaper}
          onClose={() => setSelectedWallpaper(null)}
          onSaveCategory={handleSaveCategory}
          onDelete={(w) => setDeletingWallpaper(w)}
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
