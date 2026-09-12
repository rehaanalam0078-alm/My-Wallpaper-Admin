import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles, Lock, Mail, ArrowRight, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { isFirebaseConfigured } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { login, resetPassword, isAuthenticated, isAdmin } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  // Check if redirected because user was unauthorized
  useEffect(() => {
    if (location.state?.unauthorized) {
      setErrorMsg(
        "Access denied. This account is not authorized to use the MyWallpaper Studio Admin Panel."
      );
    }
  }, [location.state]);

  // Only redirect to dashboard if authenticated AND authorized as admin
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setErrorMsg("");
    setLoading(true);

    try {
      await login(email, password);
      success("Authenticated as Administrator.", "Welcome back");
      navigate(from, { replace: true });
    } catch (err) {
      let friendlyError = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/unauthorized-role") {
        friendlyError =
          "Access denied. This account is not authorized to use the MyWallpaper Studio Admin Panel.";
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        friendlyError = "Invalid email or password.";
      } else if (err.code === "auth/too-many-requests") {
        friendlyError = "Too many failed attempts. Please try again later.";
      } else if (err.message) {
        friendlyError = err.message;
      }
      setErrorMsg(friendlyError);
      error(friendlyError, "Sign In Error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg("Enter your email address above to receive a reset link.");
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
      success(`Password reset email sent to ${email.trim()}`);
    } catch (err) {
      setErrorMsg(err.message || "Could not send password reset email.");
    }
  };

  return (
    <div className="min-h-screen bg-[#080f17] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#6366f1]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#06b6d4]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="relative w-full max-w-md bg-[#192029] border border-[#2A374A] rounded-2xl shadow-2xl p-8 z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#232a34] border border-[#2A374A] flex items-center justify-center text-[#c0c1ff] shadow-inner mb-3">
            <Sparkles className="w-6 h-6 text-[#6366f1]" />
          </div>
          <h1 className="text-2xl font-bold text-[#dce3f0] tracking-tight">
            MyWallpaper Studio
          </h1>
          <p className="text-xs text-[#908fa0] mt-1 font-mono">
            Admin Authentication Console • v2.4
          </p>
        </div>

        {/* Hosting Config Notice */}
        {!isFirebaseConfigured && (
          <div className="mb-5 p-3 rounded-lg bg-[#eab308]/15 border border-[#eab308]/40 text-xs text-[#fef08a] flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-[#eab308] shrink-0 mt-0.5" />
            <span>Hosting Notice: Firebase environment variables (VITE_FIREBASE_*) not set in hosting dashboard.</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-lg bg-[#93000a]/25 border border-[#ef4444]/60 flex items-start gap-2.5 text-xs text-[#ffb4ab] animate-fade-in shadow-lg">
            <ShieldAlert className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {resetSent && (
          <div className="mb-5 p-3 rounded-lg bg-[#00885d]/20 border border-[#4edea3]/50 text-xs text-[#4edea3] animate-fade-in">
            Password reset link has been dispatched to your email address.
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c7c4d7]">
              Administrator Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#908fa0] pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mywallpaper.dev"
                className="w-full pl-9 pr-3 py-2.5 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] placeholder-[#908fa0] text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#c7c4d7]">
                Password
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-[#c0c1ff] hover:text-white transition-colors"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#908fa0] pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-[#151c25] border border-[#2A374A] rounded-lg text-[#dce3f0] placeholder-[#908fa0] text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#6366f1]/25 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Administrator Privileges...</span>
              </>
            ) : (
              <>
                <span>Sign In to Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-8 pt-4 border-t border-[#2A374A]/60 flex items-center justify-between text-[11px] font-mono text-[#908fa0]">
          <span>Firebase Auth Claims Enforced</span>
          <span className="text-[#4edea3]">Role: Admin Only</span>
        </div>
      </div>
    </div>
  );
}
