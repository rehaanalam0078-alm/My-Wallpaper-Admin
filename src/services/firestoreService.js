import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase";
import {
  normalizeCategory,
  getCategoryDisplayName,
  DEFAULT_CATEGORIES
} from "./categoryNormalizer";

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
 * Fetches all wallpapers from Firestore.
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
 * Fetches categories with true Firestore persistence.
 * Combines explicit categories from 'categories' collection with distinct categories in 'wallpapers'.
 * Returns comprehensive category objects with counts and thumbnail previews.
 */
export async function fetchCategories() {
  // 1. Read persistent categories collection
  let firestoreCategories = [];
  try {
    const catSnap = await getDocs(collection(db, CATEGORIES_COLLECTION));
    firestoreCategories = catSnap.docs.map((d) => ({
      id: d.id,
      key: d.id,
      ...d.data()
    }));
  } catch (err) {
    console.warn("Could not load categories collection:", err);
  }

  // 2. Read wallpapers to compute live counts and thumbnails
  const wallpapers = await fetchAllWallpapers();

  const categoryMap = new Map();

  // Initialize with predefined defaults
  DEFAULT_CATEGORIES.forEach((cat) => {
    categoryMap.set(cat.id, {
      key: cat.id,
      displayName: cat.name,
      count: 0,
      thumbnailUrl: null,
      isPersistent: false
    });
  });

  // Merge Firestore categories collection
  firestoreCategories.forEach((cat) => {
    const key = cat.id || cat.key || cat.normalizedName;
    if (!key) return;
    categoryMap.set(key, {
      key,
      displayName: cat.name || getCategoryDisplayName(key),
      count: 0,
      thumbnailUrl: null,
      isPersistent: true,
      createdAt: cat.createdAt || null
    });
  });

  // Aggregate live counts and sample preview images from real wallpapers
  wallpapers.forEach((wp) => {
    const norm = normalizeCategory(wp.category);
    if (!categoryMap.has(norm)) {
      categoryMap.set(norm, {
        key: norm,
        displayName: getCategoryDisplayName(norm),
        count: 0,
        thumbnailUrl: null,
        isPersistent: false
      });
    }
    const entry = categoryMap.get(norm);
    entry.count++;
    if (!entry.thumbnailUrl && wp.imageUrl) {
      entry.thumbnailUrl = wp.imageUrl;
    }
  });

  return Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Creates a new category document in the 'categories' Firestore collection.
 * Guarantees true persistence, validation, and post-write verification.
 */
export async function createCategory(rawName) {
  if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
    throw new Error("Category name cannot be empty.");
  }

  const trimmed = rawName.trim();
  if (trimmed.length < 2) {
    throw new Error("Category name must be at least 2 characters long.");
  }

  const normalizedKey = normalizeCategory(trimmed);
  if (!normalizedKey || normalizedKey === "uncategorized") {
    throw new Error("Invalid category name.");
  }

  const categoryRef = doc(db, CATEGORIES_COLLECTION, normalizedKey);

  // Check if document already exists
  const existingSnap = await getDoc(categoryRef);
  if (existingSnap.exists()) {
    throw new Error(`Category "${trimmed}" already exists.`);
  }

  const docPayload = {
    id: normalizedKey,
    key: normalizedKey,
    name: trimmed,
    normalizedName: normalizedKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    wallpaperCount: 0
  };

  // Perform Firestore write
  await setDoc(categoryRef, docPayload);

  // Post-write verification: confirm document exists in Firestore
  const verifySnap = await getDoc(categoryRef);
  if (!verifySnap.exists()) {
    throw new Error("Failed to verify category creation in Firestore.");
  }

  return {
    key: normalizedKey,
    displayName: trimmed,
    count: 0,
    thumbnailUrl: null,
    isPersistent: true
  };
}

/**
 * Renames a category with TRUE Firestore persistence.
 * If wallpapers belong to this category, executes safe chunked batch writes
 * (max 400 operations per batch) to update every wallpaper document's 'category' field.
 */
export async function renameCategory(oldKey, newRawName, onProgress) {
  if (!oldKey) throw new Error("Original category key is required.");
  if (!newRawName || typeof newRawName !== "string" || !newRawName.trim()) {
    throw new Error("New category name cannot be empty.");
  }

  const trimmedNewName = newRawName.trim();
  const newNormalizedKey = normalizeCategory(trimmedNewName);

  if (!newNormalizedKey || newNormalizedKey === "uncategorized") {
    throw new Error("Invalid new category name.");
  }

  // Case A: Just renaming display name (same key)
  if (oldKey === newNormalizedKey) {
    const catRef = doc(db, CATEGORIES_COLLECTION, oldKey);
    await setDoc(catRef, {
      id: oldKey,
      key: oldKey,
      name: trimmedNewName,
      normalizedName: oldKey,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return {
      oldKey,
      newKey: oldKey,
      displayName: trimmedNewName,
      updatedWallpapersCount: 0
    };
  }

  // Case B: Changing category key (requires wallpaper migration)
  const newCatRef = doc(db, CATEGORIES_COLLECTION, newNormalizedKey);
  const newCatSnap = await getDoc(newCatRef);
  if (newCatSnap.exists()) {
    throw new Error(`Category "${trimmedNewName}" already exists.`);
  }

  // Fetch all wallpapers that belong to oldKey
  const allWallpapers = await fetchAllWallpapers();
  const matchingWallpapers = allWallpapers.filter(
    (wp) => normalizeCategory(wp.category) === oldKey
  );

  const totalToUpdate = matchingWallpapers.length;
  let updatedCount = 0;

  // Process wallpaper updates in safe batches of 400 (Firestore limit is 500)
  const BATCH_SIZE = 400;
  for (let i = 0; i < matchingWallpapers.length; i += BATCH_SIZE) {
    const chunk = matchingWallpapers.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const wp of chunk) {
      const wpRef = doc(db, WALLPAPERS_COLLECTION, wp.id);
      batch.update(wpRef, { category: newNormalizedKey });
    }

    await batch.commit();
    updatedCount += chunk.length;

    if (onProgress) {
      onProgress({
        completed: updatedCount,
        total: totalToUpdate,
        percent: Math.round((updatedCount / totalToUpdate) * 100)
      });
    }
  }

  // Create new category document
  await setDoc(newCatRef, {
    id: newNormalizedKey,
    key: newNormalizedKey,
    name: trimmedNewName,
    normalizedName: newNormalizedKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    wallpaperCount: totalToUpdate
  });

  // Delete old category document if it existed
  try {
    const oldCatRef = doc(db, CATEGORIES_COLLECTION, oldKey);
    await deleteDoc(oldCatRef);
  } catch (err) {
    console.warn("Old category document could not be removed:", err);
  }

  // Post-write verification
  const verifySnap = await getDoc(newCatRef);
  if (!verifySnap.exists()) {
    throw new Error("Failed to verify renamed category in Firestore.");
  }

  return {
    oldKey,
    newKey: newNormalizedKey,
    displayName: trimmedNewName,
    updatedWallpapersCount: updatedCount
  };
}

/**
 * Deletes a category document from Firestore.
 * Prevents accidental deletion if wallpapers still reference it.
 */
export async function deleteCategory(categoryKey) {
  if (!categoryKey) throw new Error("Category key is required.");

  // Check if any wallpaper still uses this category
  const allWallpapers = await fetchAllWallpapers();
  const count = allWallpapers.filter(
    (wp) => normalizeCategory(wp.category) === categoryKey
  ).length;

  if (count > 0) {
    throw new Error(
      `Cannot delete category "${getCategoryDisplayName(categoryKey)}" because it still contains ${count} wallpapers. Please reassign or delete the wallpapers first.`
    );
  }

  const catRef = doc(db, CATEGORIES_COLLECTION, categoryKey);
  await deleteDoc(catRef);

  // Post-delete verification
  const verifySnap = await getDoc(catRef);
  if (verifySnap.exists()) {
    throw new Error("Failed to confirm category deletion from Firestore.");
  }

  return true;
}
