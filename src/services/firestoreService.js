import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  limit,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { normalizeCategory } from "./categoryNormalizer";

const WALLPAPERS_COLLECTION = "wallpapers";
const BATCHES_COLLECTION = "upload_batches";
const CATEGORIES_COLLECTION = "categories";

/**
 * Creates a new wallpaper document in the existing 'wallpapers' collection.
 * Stored schema guarantees consumer Android app compatibility:
 * - imageUrl (string)
 * - category (normalized string)
 * Plus non-breaking additive metadata.
 */
export async function addWallpaperDoc({
  imageUrl,
  category,
  filename,
  title,
  publicId,
  width,
  height,
  bytes,
  format
}) {
  if (!imageUrl) {
    throw new Error("Cannot save wallpaper without a valid imageUrl");
  }

  const normalizedCat = normalizeCategory(category);

  const docPayload = {
    imageUrl,
    category: normalizedCat,
    filename: filename || "wallpaper.jpg",
    title: title || (filename ? filename.replace(/\.[^/.]+$/, "") : "Untitled Wallpaper"),
    publicId: publicId || "",
    width: width || null,
    height: height || null,
    bytes: bytes || null,
    format: format || "jpg",
    createdAt: serverTimestamp(),
    timestamp: Date.now()
  };

  const docRef = await addDoc(collection(db, WALLPAPERS_COLLECTION), docPayload);
  return { id: docRef.id, ...docPayload };
}

/**
 * Updates a wallpaper's category and optional title.
 */
export async function updateWallpaperDoc(docId, updates) {
  if (!docId) throw new Error("docId required");
  const updatePayload = { ...updates };
  if (updatePayload.category) {
    updatePayload.category = normalizeCategory(updatePayload.category);
  }
  const ref = doc(db, WALLPAPERS_COLLECTION, docId);
  await updateDoc(ref, updatePayload);
}

/**
 * Deletes a wallpaper document from Firestore.
 */
export async function deleteWallpaperDoc(docId) {
  if (!docId) throw new Error("docId required");
  const ref = doc(db, WALLPAPERS_COLLECTION, docId);
  await deleteDoc(ref);
}

/**
 * Subscribes to real-time updates for recent wallpapers.
 */
export function subscribeToRecentWallpapers(callback, count = 20) {
  const q = query(
    collection(db, WALLPAPERS_COLLECTION),
    limit(count)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      callback(items);
    },
    (err) => {
      console.error("Firestore listener error:", err);
    }
  );
}

/**
 * Fetches all wallpapers from Firestore without an artificial 50-limit ceiling.
 */
export async function fetchAllWallpapers() {
  const snap = await getDocs(collection(db, WALLPAPERS_COLLECTION));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));
}

/**
 * Computes dashboard statistics from actual Firestore wallpapers.
 */
export async function computeDashboardStats() {
  const wallpapers = await fetchAllWallpapers();
  const totalWallpapers = wallpapers.length;

  const categoryCounts = {};
  let uploadedToday = 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  for (const wp of wallpapers) {
    const cat = normalizeCategory(wp.category);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    const wpTime = wp.timestamp || (wp.createdAt?.seconds ? wp.createdAt.seconds * 1000 : null);
    if (wpTime && wpTime >= startOfDayMs) {
      uploadedToday++;
    }
  }

  const activeCategoriesCount = Object.keys(categoryCounts).length;

  // Recent 6 wallpapers
  const sortedRecent = [...wallpapers]
    .sort((a, b) => {
      const timeA = a.timestamp || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const timeB = b.timestamp || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return timeB - timeA;
    })
    .slice(0, 6);

  return {
    totalWallpapers,
    activeCategoriesCount,
    uploadedToday,
    categoryCounts,
    recentWallpapers: sortedRecent
  };
}

/**
 * Saves a completed upload batch to 'upload_batches'.
 */
export async function saveBatchHistory(batchData) {
  try {
    const ref = await addDoc(collection(db, BATCHES_COLLECTION), {
      ...batchData,
      createdAt: serverTimestamp(),
      timestamp: Date.now()
    });
    return ref.id;
  } catch (err) {
    console.warn("Could not save batch history:", err);
    return null;
  }
}

/**
 * Fetches upload history batches.
 */
export async function fetchBatchHistory(maxCount = 50) {
  try {
    const snap = await getDocs(collection(db, BATCHES_COLLECTION));
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
    return items
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, maxCount);
  } catch (err) {
    console.warn("Error fetching batch history:", err);
    return [];
  }
}

/**
 * Fetches custom categories from 'categories' collection.
 */
export async function fetchCustomCategories() {
  try {
    const snap = await getDocs(collection(db, CATEGORIES_COLLECTION));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  } catch {
    return [];
  }
}

/**
 * Creates a custom category in 'categories'.
 */
export async function createCategory(categoryName) {
  const normKey = normalizeCategory(categoryName);
  const payload = {
    key: normKey,
    name: categoryName.trim(),
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, CATEGORIES_COLLECTION), payload);
  return { id: ref.id, ...payload };
}
