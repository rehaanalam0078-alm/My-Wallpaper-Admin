import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== "undefined"
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_HOSTING_FALLBACK_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "my-wallpaper-c9bf1.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://my-wallpaper-c9bf1-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "my-wallpaper-c9bf1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "my-wallpaper-c9bf1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "170203163718",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:170203163718:web:placeholder",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PLACEHOLDER"
}

if (!isFirebaseConfigured) {
  console.warn(
    "[MyWallpaper Studio] VITE_FIREBASE_API_KEY is not defined. If hosted, add environment variables in your hosting provider settings."
  );
}

// Preserve existing Firebase application instance safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const db = getFirestore(app)
export const auth = getAuth(app)