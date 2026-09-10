import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CloudUpload,
  Image,
  FolderTree,
  History,
  Settings,
  LogOut,
  User,
  PlusCircle,
  Sparkles
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function SideNavBar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await logout();
      navigate("/login");
    } catch {
      // Ignored
    }
  };

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/upload", icon: CloudUpload, label: "Upload Wallpapers" },
    { to: "/wallpapers", icon: Image, label: "Wallpaper Library" },
    { to: "/categories", icon: FolderTree, label: "Categories" },
    { to: "/history", icon: History, label: "Upload History" },
    { to: "/settings", icon: Settings, label: "Settings" }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-64 flex flex-col justify-between bg-[#192029] border-r border-[#2A374A] p-4 z-40 shrink-0 transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Top: Brand + Nav */}
        <div className="flex flex-col gap-4">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-1 py-1.5">
            <div className="w-9 h-9 rounded-lg bg-[#232a34] border border-[#2A374A] flex items-center justify-center text-[#c0c1ff] shadow-inner">
              <Sparkles className="w-5 h-5 text-[#6366f1]" />
            </div>
            <div>
              <h1 className="font-bold text-base text-[#dce3f0] tracking-tight leading-none">
                MyWallpaper
              </h1>
              <span className="font-mono text-[11px] text-[#908fa0]">
                Studio Admin v2.4
              </span>
            </div>
          </div>

          {/* Quick Action CTA */}
          <button
            onClick={() => {
              navigate("/upload");
              onClose && onClose();
            }}
            className="w-full py-2.5 px-3 bg-[#232a34] hover:bg-[#2e353f] border border-[#2A374A] text-[#dce3f0] font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm group"
          >
            <PlusCircle className="w-4 h-4 text-[#6366f1] group-hover:scale-110 transition-transform" />
            <span>Bulk Upload</span>
          </button>

          {/* Nav Links */}
          <nav className="flex flex-col gap-1 mt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-[#232a34] text-[#c0c1ff] font-semibold border-l-2 border-[#6366f1] shadow-sm"
                        : "text-[#c7c4d7] hover:bg-[#232a34]/60 hover:text-[#dce3f0]"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Status & User */}
        <div className="border-t border-[#2A374A] pt-4 flex flex-col gap-2">
          {/* CDN Status Box */}
          <div className="px-3 py-1.5 rounded bg-[#151c25] border border-[#2A374A]/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
              <span className="font-mono text-[11px] text-[#dce3f0]">CDN Online</span>
            </div>
            <span className="font-mono text-[11px] text-[#4cd7f6]">99.98%</span>
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 text-[#c7c4d7]">
            <div className="w-7 h-7 rounded-full bg-[#6366f1]/20 border border-[#6366f1]/40 flex items-center justify-center text-[#c0c1ff]">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-[#dce3f0] font-medium truncate">
                {user?.displayName || "Studio Admin"}
              </span>
              <span className="font-mono text-[10px] text-[#908fa0] truncate">
                {user?.email || "admin@mywallpaper.dev"}
              </span>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#ffb4ab] hover:bg-[#93000a]/20 text-xs font-medium transition-colors w-full text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
