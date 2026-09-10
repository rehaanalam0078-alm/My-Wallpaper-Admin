/**
 * Cloudinary Upload Service
 * Preserves existing Cloudinary endpoint and unsigned upload preset.
 */

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dghtt3gk6";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "wallpaper_upload";

/**
 * Validates a file before upload.
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported format (${file.type || "unknown"}). Only JPG, PNG, and WEBP are supported.`
    };
  }

  // 25MB max size
  const maxSize = 25 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max limit is 25MB.`
    };
  }

  return { valid: true };
}

/**
 * Reads image dimensions in browser via Image object.
 */
export function getImageDimensions(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        URL.revokeObjectURL(url);
        resolve({ width, height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: null, height: null });
      };
      img.src = url;
    } catch {
      resolve({ width: null, height: null });
    }
  });
}

/**
 * Uploads a single file to Cloudinary with real-time upload progress.
 * Returns a Promise that can be aborted via signal.
 */
export function uploadToCloudinary(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Upload aborted by user"));
      });
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          if (!result.secure_url) {
            reject(new Error("Cloudinary response missing secure_url"));
            return;
          }
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            created_at: result.created_at
          });
        } catch {
          reject(new Error("Failed to parse Cloudinary response"));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error?.message || `Cloudinary upload failed (HTTP ${xhr.status})`));
        } catch {
          reject(new Error(`Cloudinary upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during Cloudinary upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    xhr.open("POST", CLOUDINARY_UPLOAD_URL, true);
    xhr.send(formData);
  });
}

/**
 * Queue Processor for Batch Uploads with Controlled Concurrency.
 * concurrency: number of simultaneous uploads (default: 3)
 */
export async function processBatchUpload({
  items,
  concurrency = 3,
  onItemProgress,
  onItemComplete,
  onItemFail,
  signal,
  isPaused
}) {
  const queue = [...items];
  const activeWorkers = [];

  const worker = async () => {
    while (queue.length > 0) {
      if (signal?.aborted) break;

      // Check pause
      while (isPaused && isPaused()) {
        await new Promise((r) => setTimeout(r, 300));
        if (signal?.aborted) break;
      }
      if (signal?.aborted) break;

      const item = queue.shift();
      if (!item) break;

      try {
        const result = await uploadToCloudinary(item.file, {
          signal,
          onProgress: (prog) => {
            onItemProgress && onItemProgress(item.id, prog);
          }
        });
        onItemComplete && (await onItemComplete(item, result));
      } catch (err) {
        if (signal?.aborted) return;
        onItemFail && onItemFail(item, err);
      }
    }
  };

  const poolSize = Math.min(concurrency, items.length);
  for (let i = 0; i < poolSize; i++) {
    activeWorkers.push(worker());
  }

  await Promise.all(activeWorkers);
}
