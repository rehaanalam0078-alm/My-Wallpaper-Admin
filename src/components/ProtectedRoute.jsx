import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080f17] flex flex-col items-center justify-center gap-3 text-[#dce3f0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#c0c1ff]" />
        <span className="font-mono text-xs text-[#908fa0] tracking-wider uppercase">
          Verifying Admin Authorization...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
