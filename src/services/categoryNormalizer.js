/**
 * Category Normalization Service
 * Single source of truth matching the Android application's CategoryNormalizer
 */

const KNOWN_ALIASES = {
  ainme: "anime",
  aninme: "anime",
  amime: "anime",
  hindusim: "hinduism",
  hindu: "hinduism",
  car: "cars",
  kitty: "kitty",
  kitties: "kitty",
  islam: "islamic",
  dark: "amoled",
  amoled: "amoled",
  "amoled dark": "amoled",
  scifi: "cyberpunk",
  "sci-fi": "cyberpunk"
};

const CANONICAL_DISPLAY_NAMES = {
  anime: "Anime",
  cars: "Cars",
  nature: "Nature",
  kitty: "Kitty",
  hinduism: "Hinduism",
  hindusim: "Hinduism",
  islamic: "Islamic",
  amoled: "AMOLED & Dark",
  cyberpunk: "Cyberpunk",
  abstract: "Abstract & 3D",
  minimalist: "Minimalist"
};

/**
 * Normalizes raw category string to canonical lowercase key.
 * E.g., "  Ainme  " -> "anime", "HINDUSIM" -> "hinduism"
 */
export function normalizeCategory(raw) {
  if (!raw || typeof raw !== "string") return "uncategorized";
  const cleaned = raw.trim().toLowerCase();
  return KNOWN_ALIASES[cleaned] || cleaned;
}

/**
 * Returns formatted UI display name for a category key.
 * E.g. "anime" -> "Anime", "hindusim" -> "Hinduism"
 */
export function getCategoryDisplayName(raw) {
  if (!raw) return "Uncategorized";
  const normalized = normalizeCategory(raw);
  if (CANONICAL_DISPLAY_NAMES[normalized]) {
    return CANONICAL_DISPLAY_NAMES[normalized];
  }
  // Title case fallback
  return normalized
    .split(/[\s-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Checks if a wallpaper's category matches target category considering aliases.
 */
export function isCategoryMatch(wallpaperCategory, targetCategory) {
  if (!targetCategory || targetCategory.toLowerCase() === "all") return true;
  const normWp = normalizeCategory(wallpaperCategory);
  const normTarget = normalizeCategory(targetCategory);
  return normWp === normTarget;
}

export const DEFAULT_CATEGORIES = [
  { id: "anime", name: "Anime" },
  { id: "cars", name: "Cars" },
  { id: "nature", name: "Nature" },
  { id: "kitty", name: "Kitty" },
  { id: "hinduism", name: "Hinduism" },
  { id: "islamic", name: "Islamic" },
  { id: "amoled", name: "AMOLED & Dark" },
  { id: "cyberpunk", name: "Cyberpunk" },
  { id: "abstract", name: "Abstract & 3D" }
];
