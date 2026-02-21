/**
 * Check if an object has all specified fields defined (not null/undefined)
 * @param {Object} obj - Object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid and missingFields
 */
export function objectHasAllDefinedFields(obj, requiredFields) {
  const missingFields = requiredFields.filter(
    (field) => obj[field] === undefined || obj[field] === null
  );
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}
