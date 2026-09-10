import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ToastContainer from "./components/ToastContainer";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BulkUpload from "./pages/BulkUpload";
import WallpaperLibrary from "./pages/WallpaperLibrary";
import Categories from "./pages/Categories";
import CategoryDetail from "./pages/CategoryDetail";
import UploadHistory from "./pages/UploadHistory";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <>
      <Routes>
        {/* Public Admin Sign-In */}
        <Route path="/login" element={<Login />} />

        {/* Protected Admin Console Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="upload" element={<BulkUpload />} />
          <Route path="wallpapers" element={<WallpaperLibrary />} />
          <Route path="categories" element={<Categories />} />
          <Route path="categories/:category" element={<CategoryDetail />} />
          <Route path="history" element={<UploadHistory />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Toast Drawer */}
      <ToastContainer />
    </>
  );
}