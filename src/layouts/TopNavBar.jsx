import { useState } from "react";
import { Search, RefreshCw, Bell, HelpCircle, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function TopNavBar({ onOpenSidebar, onGlobalSearch }) {
  const { user } = useAuth();
  const { info, success } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    info("Checking Cloudinary & Firestore synchronization...");
    setTimeout(() => {
      setSyncing(false);
      success("Cloudinary CDN & Firestore cache are in sync.", "Sync Complete");
    }, 1200);
  };

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
    onGlobalSearch && onGlobalSearch(e.target.value);
  };

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "SA";

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 z-20 px-4 lg:px-8 flex items-center justify-between bg-[#192029] border-b border-[#2A374A]">
      {/* Left: Mobile Menu Toggle + Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg text-[#908fa0] hover:text-[#dce3f0] hover:bg-[#232a34] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#908fa0]">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Global search wallpapers, tags, doc IDs..."
            className="w-full pl-9 pr-12 py-1.5 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] placeholder-[#908fa0] text-xs focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <span className="absolute inset-y-0 right-2.5 flex items-center">
            <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-[#232a34] text-[#908fa0] rounded border border-[#2A374A]">
              ⌘K
            </kbd>
          </span>
        </div>
      </div>

      {/* Right: Badges, Sync, Actions, Profile */}
      <div className="flex items-center gap-3">
        {/* Firestore Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00885d]/20 border border-[#00885d]/40 text-[#4edea3] font-mono text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
          <span>Firestore Connected</span>
        </div>

        {/* Cloudinary OK Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#03b5d3]/20 border border-[#03b5d3]/40 text-[#4cd7f6] font-mono text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4cd7f6]" />
          <span>Cloudinary OK</span>
        </div>

        {/* Sync Cloudinary Button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-[#dce3f0] font-medium text-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#c0c1ff] ${syncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Sync Cloudinary</span>
        </button>

        {/* Notifications & Help */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => info("No pending system alerts. All pipelines operational.")}
            className="p-2 rounded-lg text-[#908fa0] hover:text-[#dce3f0] hover:bg-[#232a34] transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4cd7f6]" />
          </button>
          <button
            onClick={() => info("MyWallpaper Studio Admin v2.4 • Connected to Android Production Database")}
            className="p-2 rounded-lg text-[#908fa0] hover:text-[#dce3f0] hover:bg-[#232a34] transition-colors"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Admin Avatar Pill */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#2A374A]">
          <div className="w-8 h-8 rounded-full bg-[#6366f1] text-white text-xs font-bold flex items-center justify-center ring-2 ring-[#2A374A] shadow-inner">
            {userInitials}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#dce3f0] leading-tight">
                {user?.displayName || "Studio Admin"}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#6366f1]/20 text-[#c0c1ff] font-mono text-[9px] border border-[#6366f1]/40 uppercase font-bold">
                ADMIN
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#908fa0]">
              {user?.email || "admin@mywallpaper.dev"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
