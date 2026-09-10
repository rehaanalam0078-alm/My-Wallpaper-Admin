import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { History, RefreshCw, CheckCircle2, AlertTriangle, UploadCloud } from "lucide-react";
import { fetchBatchHistory } from "../services/firestoreService";
import { getCategoryDisplayName } from "../services/categoryNormalizer";
import { useToast } from "../context/ToastContext";

export default function UploadHistory() {
  const navigate = useNavigate();
  const { error } = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBatchHistory(50);
      setBatches(data);
    } catch {
      error("Could not fetch upload history.");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="p-6 lg:p-10 max-w-[1720px] mx-auto space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A374A] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#dce3f0] tracking-tight">
              Upload History
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#192029] text-[#c0c1ff] font-mono text-xs border border-[#2A374A]">
              {batches.length} Batches Logged
            </span>
          </div>
          <p className="text-xs lg:text-sm text-[#908fa0]">
            Audit log of all bulk upload operations, Cloudinary payloads, and Firestore document commits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadHistory}
            disabled={loading}
            className="p-2 rounded-lg bg-[#192029] hover:bg-[#232a34] border border-[#2A374A] text-[#dce3f0] transition-colors"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold shadow-lg shadow-[#6366f1]/25 transition-all active:scale-[0.98]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>New Bulk Upload</span>
          </button>
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#6366f1] animate-spin" />
          <span className="font-mono text-xs text-[#908fa0]">
            Fetching upload batch telemetry...
          </span>
        </div>
      ) : batches.length === 0 ? (
        <div className="p-16 rounded-2xl bg-[#192029] border border-[#2A374A] text-center space-y-3">
          <History className="w-8 h-8 text-[#908fa0] mx-auto opacity-50" />
          <h3 className="font-bold text-sm text-[#dce3f0]">No upload history recorded yet</h3>
          <p className="text-xs text-[#908fa0] max-w-sm mx-auto">
            Once you perform bulk uploads in the Studio, complete audit batches will appear here.
          </p>
          <button
            onClick={() => navigate("/upload")}
            className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-xs font-semibold text-white mt-2"
          >
            Upload Your First Batch
          </button>
        </div>
      ) : (
        <div className="bg-[#192029] border border-[#2A374A] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-[#2A374A] text-[#908fa0] uppercase text-[10px] bg-[#151c25]">
              <tr>
                <th className="py-3 px-4">Batch ID</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Primary Category</th>
                <th className="py-3 px-4">Total Files</th>
                <th className="py-3 px-4">Successful</th>
                <th className="py-3 px-4">Failed</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A374A]/40">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-[#151c25]/60 transition-colors">
                  <td className="py-3 px-4 text-[#c0c1ff] font-bold">
                    #{b.batchId || b.id.substring(0, 8)}
                  </td>
                  <td className="py-3 px-4 text-[#dce3f0]">
                    {b.date ? new Date(b.date).toLocaleString() : "Recent"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#232a34] text-[#4cd7f6] text-[11px]">
                      {getCategoryDisplayName(b.category)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#dce3f0]">
                    {b.totalFiles || 0}
                  </td>
                  <td className="py-3 px-4 text-[#4edea3]">
                    {b.successCount || 0}
                  </td>
                  <td className="py-3 px-4">
                    {b.failCount > 0 ? (
                      <span className="text-[#ef4444] font-bold">{b.failCount}</span>
                    ) : (
                      <span className="text-[#908fa0]">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {b.status === "Published" ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#00885d]/20 text-[#4edea3] text-[10px] flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Published
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] text-[10px] flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" /> Partial
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => navigate(`/wallpapers?category=${b.category}`)}
                      className="px-3 py-1 rounded bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-[11px] text-[#dce3f0] hover:text-white"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
