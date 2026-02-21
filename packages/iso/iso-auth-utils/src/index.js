/**
 * Isomorphic authentication utilities for Buydy applications
 * These functions can run on both client and server
 */

// Validation functions
export { objectHasAllDefinedFields } from "./validation/objectHasAllDefinedFields.js";
export { isValidEmailFormat } from "./validation/isValidEmailFormat.js";
export { formatUserDisplayName } from "./validation/formatUserDisplayName.js";

// Security functions
export { removeSensitiveUserFields } from "./security/removeSensitiveUserFields.js";
export { generateRandomAlphanumericString } from "./security/generateRandomAlphanumericString.js";

// Date functions
export { isTimestampExpired } from "./date/isTimestampExpired.js";
export { getFutureTimestampFromSeconds } from "./date/getFutureTimestampFromSeconds.js";

// Response functions
export { formatApiErrorResponse } from "./response/formatApiErrorResponse.js";
export { formatApiSuccessResponse } from "./response/formatApiSuccessResponse.js";
