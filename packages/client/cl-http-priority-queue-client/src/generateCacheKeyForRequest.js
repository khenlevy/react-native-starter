/**
 * Fast hash function for generating cache keys
 * Using FNV-1a algorithm which is fast and has good distribution
 * @param {string} str - String to hash
 * @returns {string} - 8-character hex hash
 */
function fastHashForString(str) {
  let hash = 2166136261; // FNV-1a offset basis (32-bit)

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  // Convert to unsigned 32-bit integer and then to hex
  return (hash >>> 0).toString(36); // Base36 for shorter keys
}

/**
 * Generate a unique, fast, and efficient cache key for HTTP requests
 * Format: [hash]-[method]-[endpoint]
 *
 * @param {Object} config - Axios request config
 * @returns {string} - Cache key (e.g., "1k8x7f2-GET-jobs")
 */
export function generateCacheKeyForRequest(config) {
  const { method = 'GET', url, params, data, baseURL = '' } = config;

  // Extract endpoint from URL (remove baseURL if present)
  let endpoint = url || '';
  if (baseURL && endpoint.startsWith(baseURL)) {
    endpoint = endpoint.slice(baseURL.length);
  }

  // Remove leading slash and keep only the path
  endpoint = endpoint.replace(/^\//, '').split('?')[0];

  // Normalize endpoint: replace slashes with hyphens for readability
  const normalizedEndpoint = endpoint.replace(/\//g, '-');

  // Create content string for hashing (params + data)
  const contentParts = [];

  // Add sorted params
  if (params && Object.keys(params).length > 0) {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    contentParts.push(sortedParams);
  }

  // Add data (for POST/PUT/PATCH)
  if (data && Object.keys(data).length > 0) {
    contentParts.push(JSON.stringify(data));
  }

  // Generate hash only if there's content to hash
  const contentHash =
    contentParts.length > 0 ? fastHashForString(contentParts.join('|')) : '';

  // Build cache key: method-endpoint-hash
  // e.g., "GET-jobs" or "GET-jobs-1k8x7f2" (with params)
  const parts = [method.toUpperCase(), normalizedEndpoint];
  if (contentHash) {
    parts.push(contentHash);
  }

  return parts.join('-');
}

/**
 * Generate cache key from URL and options (convenience method)
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Object} params - Query parameters
 * @param {Object} data - Request body
 * @returns {string} - Cache key
 */
export function generateCacheKeyFromParts(
  method,
  url,
  params = null,
  data = null,
) {
  return generateCacheKeyForRequest({ method, url, params, data });
}
