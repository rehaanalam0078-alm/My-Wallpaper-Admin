import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyCSSZVhkk9Z74An5VgkzBXOqFdwaZVHYxk",
  authDomain: "my-wallpaper-c9bf1.firebaseapp.com",
  databaseURL: "https://my-wallpaper-c9bf1-default-rtdb.firebaseio.com",
  projectId: "my-wallpaper-c9bf1",
  storageBucket: "my-wallpaper-c9bf1.firebasestorage.app",
  messagingSenderId: "170203163718",
  appId: "1:170203163718:web:c2fd173cd11b34de73ae47",
  measurementId: "G-YGKB61E36Q"
}

// Preserve existing Firebase application instance safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const db = getFirestore(app)
export const auth = getAuth(app)