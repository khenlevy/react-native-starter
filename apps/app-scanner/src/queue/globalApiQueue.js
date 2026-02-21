// Deprecated: global API queue removed in favor of isomorphic HTTP client rate limiting
export function getGlobalApiQueue() {
  throw new Error(
    "globalApiQueue is deprecated. Use the isomorphic HTTP client and EODHDClient rate limiting instead."
  );
}

export const globalApiQueue = null;
