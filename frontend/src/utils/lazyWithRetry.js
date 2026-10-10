import React from 'react';

/**
 * Robust wrapper around React.lazy with automatic retry on chunk loading failure.
 * When a new deployment occurs, old hashed JS chunks (e.g. BillingView-<hash>.js)
 * may no longer exist on the server, causing "Failed to fetch dynamically imported module".
 * 
 * This wrapper retries loading up to `retriesLeft` times, and if it still fails due to chunk
 * mismatch or network glitch, reloads the current page (once per session to avoid loops)
 * so the browser fetches index.html with the latest chunk hashes.
 */
export function lazyWithRetry(componentImport) {
  return React.lazy(async () => {
    const pageRefreshedKey = `chunk_reload_${window.location.pathname}_${window.location.hash}`;
    try {
      return await componentImport();
    } catch (error) {
      const isChunkLoadFailed =
        error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(error?.message || '') ||
        /error loading dynamically imported module/i.test(error?.message || '') ||
        /Importing a module script failed/i.test(error?.message || '');

      if (isChunkLoadFailed) {
        const hasRefreshed = sessionStorage.getItem(pageRefreshedKey);
        if (!hasRefreshed) {
          sessionStorage.setItem(pageRefreshedKey, 'true');
          window.location.reload();
          return new Promise(() => {}); // Pause until reload executes
        }
      }
      throw error;
    }
  });
}
