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
  where,
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

  // Asynchronously dispatch notifications for genuine new wallpaper creations
  dispatchNewWallpaperNotification({
    wallpaperId: docRef.id,
    imageUrl: docPayload.imageUrl,
    category: docPayload.category,
    title: docPayload.title
  }).catch((err) => {
    console.warn("[Admin Notification Bridge] Background dispatch error:", err);
  });

  return { id: docRef.id, ...docPayload };
}

/**
 * Sets a wallpaper as the single Featured Hero wallpaper on the app home screen.
 * If isFeatured is true, unsets all other wallpapers currently marked as featured.
 */
export async function setFeaturedWallpaper(docId, isFeatured = true) {
  if (!docId) throw new Error("docId required");

  const batch = writeBatch(db);

  if (isFeatured) {
    try {
      const q = query(
        collection(db, WALLPAPERS_COLLECTION),
        where("isFeatured", "==", true)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        if (d.id !== docId) {
          const prevRef = doc(db, WALLPAPERS_COLLECTION, d.id);
          batch.set(prevRef, { isFeatured: false, featured: false }, { merge: true });
        }
      });
    } catch (queryErr) {
      console.warn("Could not query isFeatured docs with where filter, checking all:", queryErr);
      const all = await fetchAllWallpapers();
      const prevFeatured = all.filter((w) => (w.isFeatured || w.featured) && w.id !== docId);
      for (const prev of prevFeatured) {
        const prevRef = doc(db, WALLPAPERS_COLLECTION, prev.id);
        batch.set(prevRef, { isFeatured: false, featured: false }, { merge: true });
      }
    }
  }

  // Set BOTH isFeatured AND featured so Android Kotlin models deserialize correctly regardless of JavaBeans naming
  const targetRef = doc(db, WALLPAPERS_COLLECTION, docId);
  batch.set(targetRef, {
    isFeatured: Boolean(isFeatured),
    featured: Boolean(isFeatured)
  }, { merge: true });

  await batch.commit();
  return { docId, isFeatured: Boolean(isFeatured) };
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
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      isFeatured: Boolean(data.isFeatured || data.featured)
    };
  });
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
 * Honors isDeleted flags so deleted categories do not resurrect.
 * Returns comprehensive category objects with counts and thumbnail previews.
 */
export async function fetchCategories() {
  // 1. Read persistent categories collection
  let firestoreCategories = [];
  const deletedCategoryKeys = new Set();

  try {
    const catSnap = await getDocs(collection(db, CATEGORIES_COLLECTION));
    catSnap.docs.forEach((d) => {
      const data = d.data();
      const key = d.id || data.key || data.normalizedName;
      if (data.isDeleted) {
        if (key) deletedCategoryKeys.add(key);
      } else {
        firestoreCategories.push({
          id: d.id,
          key: key || d.id,
          ...data
        });
      }
    });
  } catch (err) {
    console.warn("Could not load categories collection:", err);
  }

  // 2. Read wallpapers to compute live counts and thumbnails
  const wallpapers = await fetchAllWallpapers();
  const categoryMap = new Map();

  // Initialize with predefined defaults (unless explicitly marked deleted)
  DEFAULT_CATEGORIES.forEach((cat) => {
    if (!deletedCategoryKeys.has(cat.id)) {
      categoryMap.set(cat.id, {
        key: cat.id,
        displayName: cat.name,
        count: 0,
        thumbnailUrl: null,
        isPersistent: false
      });
    }
  });

  // Merge Firestore categories collection
  firestoreCategories.forEach((cat) => {
    const key = cat.id || cat.key || cat.normalizedName;
    if (!key || deletedCategoryKeys.has(key)) return;
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
    if (!norm || norm === "uncategorized" || deletedCategoryKeys.has(norm)) return;

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

  return Array.from(categoryMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.displayName.localeCompare(b.displayName);
  });
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

  // Check if document already exists and is active
  const existingSnap = await getDoc(categoryRef);
  if (existingSnap.exists()) {
    const existingData = existingSnap.data();
    if (!existingData.isDeleted) {
      throw new Error(`Category "${trimmed}" already exists.`);
    }
  }

  const docPayload = {
    id: normalizedKey,
    key: normalizedKey,
    name: trimmed,
    normalizedName: normalizedKey,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    wallpaperCount: 0
  };

  // Perform Firestore write
  await setDoc(categoryRef, docPayload);

  // Post-write verification: confirm document exists in Firestore
  const verifySnap = await getDoc(categoryRef);
  if (!verifySnap.exists() || verifySnap.data().isDeleted) {
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
      isDeleted: false,
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
  if (newCatSnap.exists() && !newCatSnap.data().isDeleted) {
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
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    wallpaperCount: totalToUpdate
  });

  // Delete old category document or mark as deleted
  try {
    const oldCatRef = doc(db, CATEGORIES_COLLECTION, oldKey);
    const isDefault = DEFAULT_CATEGORIES.some((c) => c.id === oldKey);
    if (isDefault) {
      await setDoc(oldCatRef, {
        id: oldKey,
        key: oldKey,
        name: getCategoryDisplayName(oldKey),
        normalizedName: oldKey,
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await deleteDoc(oldCatRef);
    }
  } catch (err) {
    console.warn("Old category document cleanup notice:", err);
  }

  // Post-write verification
  const verifySnap = await getDoc(newCatRef);
  if (!verifySnap.exists() || verifySnap.data().isDeleted) {
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
 * Deletes a category with complete options:
 * - Direct delete if 0 wallpapers
 * - Wallpaper reassignment if requested
 * - Cascade delete of all wallpapers if requested
 * - Prevents resurrection of default categories using Firestore tombstones
 */
export async function deleteCategory(
  categoryKey,
  { cascadeDeleteWallpapers = false, reassignToCategory = null, onProgress = null } = {}
) {
  if (!categoryKey) throw new Error("Category key is required.");

  // 1. Fetch matching wallpapers
  const allWallpapers = await fetchAllWallpapers();
  const matchingWallpapers = allWallpapers.filter(
    (wp) => normalizeCategory(wp.category) === categoryKey
  );

  const count = matchingWallpapers.length;

  // 2. Handle wallpapers if any exist
  if (count > 0) {
    if (reassignToCategory) {
      const targetKey = normalizeCategory(reassignToCategory);
      if (!targetKey || targetKey === "uncategorized" || targetKey === categoryKey) {
        throw new Error("Please select a different, valid category to reassign wallpapers to.");
      }

      const BATCH_SIZE = 400;
      let updatedCount = 0;
      for (let i = 0; i < matchingWallpapers.length; i += BATCH_SIZE) {
        const chunk = matchingWallpapers.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const wp of chunk) {
          const wpRef = doc(db, WALLPAPERS_COLLECTION, wp.id);
          batch.update(wpRef, { category: targetKey });
        }

        await batch.commit();
        updatedCount += chunk.length;

        if (onProgress) {
          onProgress({
            completed: updatedCount,
            total: count,
            percent: Math.round((updatedCount / count) * 100),
            action: "reassigning"
          });
        }
      }
    } else if (cascadeDeleteWallpapers) {
      const BATCH_SIZE = 400;
      let deletedCount = 0;
      for (let i = 0; i < matchingWallpapers.length; i += BATCH_SIZE) {
        const chunk = matchingWallpapers.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const wp of chunk) {
          const wpRef = doc(db, WALLPAPERS_COLLECTION, wp.id);
          batch.delete(wpRef);
        }

        await batch.commit();
        deletedCount += chunk.length;

        if (onProgress) {
          onProgress({
            completed: deletedCount,
            total: count,
            percent: Math.round((deletedCount / count) * 100),
            action: "deleting"
          });
        }
      }
    } else {
      throw new Error(
        `Category contains ${count} wallpapers. Choose to reassign them or delete them with the category.`
      );
    }
  }

  // 3. Remove or tombstone the category document
  const catRef = doc(db, CATEGORIES_COLLECTION, categoryKey);
  const isDefault = DEFAULT_CATEGORIES.some((c) => c.id === categoryKey);

  if (isDefault) {
    // Record tombstone so default categories don't resurrect
    await setDoc(catRef, {
      id: categoryKey,
      key: categoryKey,
      name: getCategoryDisplayName(categoryKey),
      normalizedName: categoryKey,
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    // Custom category: delete doc directly from Firestore
    await deleteDoc(catRef);
  }

  return true;
}

/**
 * Dispatches in-app notifications to all eligible users when a new wallpaper is created.
 * Enforces strict idempotency via /events/NEW_WALLPAPER_{wallpaperId}.
 * Strictly executed ONLY when adding a new wallpaper document.
 * Edits, featured toggles, and metadata updates never call this function.
 */
export async function dispatchNewWallpaperNotification({ wallpaperId, imageUrl, category, title }) {
  if (!wallpaperId) return;

  const eventKey = `NEW_WALLPAPER_${wallpaperId}`;
  const eventRef = doc(db, "events", eventKey);

  try {
    const eventSnap = await getDoc(eventRef);
    if (eventSnap.exists()) {
      const data = eventSnap.data();
      if (data.status === "completed" || data.status === "processing") {
        console.log(`[Notification Bridge] Wallpaper ${wallpaperId} notification already handled.`);
        return;
      }
    }

    // Set idempotency record immediately
    await setDoc(eventRef, {
      wallpaperId,
      status: "processing",
      source: "admin_client_bridge",
      createdAt: serverTimestamp()
    });

    // Fetch registered users
    const usersSnap = await getDocs(collection(db, "users"));
    if (usersSnap.empty) {
      console.log("[Notification Bridge] No users found in Firestore.");
      await setDoc(
        eventRef,
        { status: "completed", notifiedCount: 0, completedAt: serverTimestamp() },
        { merge: true }
      );
      return;
    }

    const notifTitle = `New ${category || "Wallpaper"}!`;
    const notifBody = title
      ? `Check out "${title}" in ${category || "the gallery"}.`
      : `Discover the newest wallpaper added to ${category || "our collection"}!`;

    const userDocs = usersSnap.docs;
    let notifiedCount = 0;
    const CHUNK_SIZE = 400; // Under Firestore 500 batch limit

    for (let i = 0; i < userDocs.length; i += CHUNK_SIZE) {
      const chunk = userDocs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const uDoc of chunk) {
        const uData = uDoc.data() || {};
        const settings = uData.notificationSettings || {};
        // Respect user opt-out; default to enabled
        if (settings.newWallpapers === false) {
          continue;
        }

        const notifRef = doc(collection(db, "users", uDoc.id, "notifications"));
        batch.set(notifRef, {
          title: notifTitle,
          body: notifBody,
          imageUrl: imageUrl || "",
          wallpaperId: String(wallpaperId),
          category: String(category || ""),
          type: "NEW_WALLPAPER",
          read: false,
          createdAt: serverTimestamp()
        });
        batchCount++;
      }

      if (batchCount > 0) {
        await batch.commit();
        notifiedCount += batchCount;
      }
    }

    await setDoc(
      eventRef,
      {
        status: "completed",
        notifiedCount,
        completedAt: serverTimestamp()
      },
      { merge: true }
    );

    console.log(
      `[Notification Bridge] Successfully dispatched in-app notification to ${notifiedCount} users for wallpaper ${wallpaperId}.`
    );
  } catch (err) {
    console.warn(`[Notification Bridge] Error dispatching notification for ${wallpaperId}:`, err);
    try {
      await setDoc(
        eventRef,
        {
          status: "error",
          error: err?.message || String(err),
          failedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch {
      // Ignore fallback error
    }
  }
}

