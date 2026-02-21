import util from 'util';

const ENABLE_DEBUG = process.env.DEBUG_MODE === 'true';

/**
 * List of sensitive field names that should be filtered from logs
 * These are case-insensitive and will be replaced with [REDACTED]
 */
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'pwd',
  'secret', 'secrets',
  'token', 'tokens', 'auth_token', 'access_token', 'refresh_token',
  'key', 'api_key', 'private_key', 'public_key',
  'credential', 'credentials',
  'session', 'sessions', 'sessionid',
  'cookie', 'cookies',
  'authorization', 'auth',
  'bearer', 'jwt',
  'mongo_password', 'mongodb_password',
  'db_password', 'database_password',
  'ssh_password', 'ssh_key',
  'aws_secret', 'aws_key',
  'github_token', 'git_token',
  'slack_token', 'discord_token',
  'stripe_key', 'stripe_secret',
  'paypal_key', 'paypal_secret',
  'email_password', 'smtp_password',
  'redis_password', 'redis_key',
  'encryption_key', 'decryption_key',
  'signing_key', 'verification_key'
];

/**
 * Recursively filter sensitive data from objects
 * @param {*} obj - Object to filter
 * @param {number} depth - Current recursion depth
 * @returns {*} Filtered object
 */
function filterSensitiveData(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH_REACHED]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Check if string looks like a sensitive value (long, random-looking)
    if (obj.length > 20 && /^[a-zA-Z0-9+/=_-]+$/.test(obj)) {
      return '[POTENTIAL_SECRET]';
    }
    return obj;
  }
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => filterSensitiveData(item, depth + 1));
  }
  
  const filtered = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key matches any sensitive field pattern
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field) || field.includes(lowerKey)
    );
    
    if (isSensitive) {
      filtered[key] = '[REDACTED]';
    } else {
      filtered[key] = filterSensitiveData(value, depth + 1);
    }
  }
  
  return filtered;
}

/**
 * Format message with metadata using fast shallow inspection
 * Automatically filters sensitive data from metadata
 * @param {string} level - Log level
 * @param {string} message - Main log message
 * @param {*} meta - Optional metadata
 * @returns {string} Formatted message
 */
function formatMessage(level, message, meta) {
  if (!meta) return message;
  try {
    // Filter sensitive data from metadata
    const filteredMeta = filterSensitiveData(meta);
    return `${message} ${util.inspect(filteredMeta, { depth: 1, breakLength: 80 })}`;
  } catch {
    return `${message} [meta_error]`;
  }
}

/**
 * High-performance log function using direct stdout
 * @param {string} level - Log level ('debug' or 'business')
 * @param {string} message - Log message
 * @param {*} meta - Optional metadata
 */
function log(level, message, meta) {
  // Early return for disabled debug logs - zero cost when off
  if (level === 'debug' && !ENABLE_DEBUG) return;

  const time = new Date().toISOString();
  const formatted = formatMessage(level, message, meta);

  // Use direct stdout for performance (faster than console)
  process.stdout.write(
    JSON.stringify({ time, level, message: formatted }) + '\n'
  );
}

/**
 * Debug log - only outputs if DEBUG_MODE=true
 * @param {string} msg - Log message
 * @param {*} meta - Optional metadata
 */
export function debug(msg, meta) {
  log('debug', msg, meta);
}

/**
 * Business log - always outputs (production-safe)
 * @param {string} msg - Log message
 * @param {*} meta - Optional metadata
 */
export function business(msg, meta) {
  log('business', msg, meta);
}

/**
 * Safe log function that explicitly filters sensitive data
 * Use this when you want to be extra sure no secrets are logged
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} meta - Optional metadata
 */
export function safe(level, message, meta) {
  log(level, message, meta);
}

/**
 * Log connection details safely (filters passwords from URLs)
 * @param {string} msg - Log message
 * @param {string} url - Connection URL (will be filtered)
 * @param {*} meta - Optional metadata
 */
export function connection(msg, url, meta = {}) {
  // Filter password from URL
  const filteredUrl = url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1[REDACTED]$2');
  business(msg, { url: filteredUrl, ...meta });
}

/**
 * Generic log function (exposed for flexibility)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} meta - Optional metadata
 */
export { log };

// Default export with all methods
export default {
  debug,
  business,
  log,
  safe,
  connection,
};

