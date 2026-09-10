import { useState } from "react";
import { Outlet } from "react-router-dom";
import SideNavBar from "./SideNavBar";
import TopNavBar from "./TopNavBar";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#080f17] text-[#dce3f0] flex flex-col">
      {/* Persistent Sidebar */}
      <SideNavBar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Top Utility Header */}
      <TopNavBar
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Main Workspace Canvas */}
      <main className="lg:ml-64 pt-16 min-h-screen pb-16 flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
