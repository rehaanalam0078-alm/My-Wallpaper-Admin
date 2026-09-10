import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCSSZVhkk9Z74An5VgkzBXOqFdwaZVHYxk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "my-wallpaper-c9bf1.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://my-wallpaper-c9bf1-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "my-wallpaper-c9bf1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "my-wallpaper-c9bf1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "170203163718",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:170203163718:web:c2fd173cd11b34de73ae47",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-YGKB61E36Q"
}

// Preserve existing Firebase application instance safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const db = getFirestore(app)
export const auth = getAuth(app)