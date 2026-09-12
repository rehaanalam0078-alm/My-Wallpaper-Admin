import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Authoritative check reading Firebase Auth Custom Claims directly from the ID token
  const verifyAdminClaims = useCallback(async (currentUser, forceRefresh = false) => {
    if (!currentUser) return false;
    try {
      const tokenResult = await currentUser.getIdTokenResult(forceRefresh);
      const claims = tokenResult.claims || {};
      const authorized = Boolean(claims.admin === true || claims.role === "admin");
      return authorized;
    } catch (err) {
      console.warn("Could not read auth token claims:", err);
      return false;
    }
  }, []);

  const refreshUserClaims = useCallback(async () => {
    if (!auth.currentUser) {
      setIsAdmin(false);
      return false;
    }
    const authorized = await verifyAdminClaims(auth.currentUser, true);
    setIsAdmin(authorized);
    return authorized;
  }, [verifyAdminClaims]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Authoritatively check custom claims
        const authorized = await verifyAdminClaims(currentUser, false);
        setIsAdmin(authorized);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [verifyAdminClaims]);

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    // Immediately force-refresh token to get authoritative custom claims
    const tokenResult = await cred.user.getIdTokenResult(true);
    const claims = tokenResult.claims || {};
    const authorized = Boolean(claims.admin === true || claims.role === "admin");

    if (!authorized) {
      // Reject non-admin user immediately: sign them out of the console
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      const err = new Error(
        "Access denied. This account is not authorized to use the MyWallpaper Studio Admin Panel."
      );
      err.code = "auth/unauthorized-role";
      throw err;
    }

    setUser(cred.user);
    setIsAdmin(true);
    return cred;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } finally {
      setUser(null);
      setIsAdmin(false);
    }
  };

  const resetPassword = async (email) => {
    if (!email) throw new Error("Please provide your email address.");
    await sendPasswordResetEmail(auth, email.trim());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        login,
        logout,
        resetPassword,
        refreshUserClaims,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
