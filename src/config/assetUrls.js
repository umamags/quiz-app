// Asset URL builder for local development vs production deployment
// In development: uses local files from public/
// In preview (localhost): uses local files from public/ (mimics dev mode)
// In production (ai-lab.in): uses remote URLs from https://ai-lab.in/data/quiz-app/

const FETCH_TIMEOUT_MS = 5000;

// Detect if running on production server (ai-lab.in)
// Preview mode on localhost will use local files
const isProd = typeof window !== 'undefined' && window.location.hostname.includes('ai-lab.in');

const PROD_BASE = 'https://ai-lab.in/data/quiz-app';
const DEV_BASE = '';

function buildUrl(category, filename, pathPrefix) {
  if (isProd) {
    return `${PROD_BASE}/${pathPrefix}/${category}/${filename}`;
  }
  return `${DEV_BASE}/${pathPrefix}/${category}/${filename}`;
}

function buildMiscImageUrl(filename) {
  if (isProd) {
    return `${PROD_BASE}/images/misc/${filename}`;
  }
  return `${DEV_BASE}/images/${filename}`;
}

export function getAudioUrl(relativePath) {
  // relativePath: "audio/animals/dog.mp3" or just "animals/dog.mp3"
  const path = relativePath.startsWith('audio/') ? relativePath.substring(6) : relativePath;
  const [category, ...rest] = path.split('/');
  const filename = rest.join('/');

  if (isProd) {
    return `${PROD_BASE}/audio/${category}/${filename}`;
  }
  return `${DEV_BASE}/audio/${category}/${filename}`;
}

export function getImageUrl(relativePath) {
  // relativePath: "images_downloaded/animals/dog_1_xyz.jpg"
  const path = relativePath.startsWith('images_downloaded/') ? relativePath.substring(18) : relativePath;
  const [category, ...rest] = path.split('/');
  const filename = rest.join('/');

  if (isProd) {
    return `${PROD_BASE}/images/${category}/${filename}`;
  }
  return `${DEV_BASE}/images_downloaded/${category}/${filename}`;
}

export function getCountryImageUrl(relativePath) {
  // relativePath: "countries_images/Africa/algeria.gif"
  const path = relativePath.startsWith('countries_images/') ? relativePath.substring(17) : relativePath;
  const [continent, ...rest] = path.split('/');
  const filename = rest.join('/');

  if (isProd) {
    return `${PROD_BASE}/countries_images/${continent}/${filename}`;
  }
  return `${DEV_BASE}/countries_images/${continent}/${filename}`;
}

export function getMiscImageUrl(filename) {
  // For images from /images directory (misc/uncategorized)
  if (isProd) {
    return `${PROD_BASE}/images/misc/${filename}`;
  }
  return `${DEV_BASE}/images/${filename}`;
}

export function isProdEnvironment() {
  return isProd;
}

// Helper to fetch with timeout and error handling
export async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Fetch timeout for URL: ${url} (${FETCH_TIMEOUT_MS}ms)`);
    }
    throw error;
  }
}
