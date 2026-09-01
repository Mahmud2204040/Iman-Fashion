/**
 * Tiny async delay helper used by every mock service.
 *
 * Centralizing this prevents drift between services (some using 200ms,
 * others 500ms). The mock layer stays roughly the same feel everywhere.
 *
 * @param {number} ms — milliseconds to wait.
 * @returns {Promise<void>}
 */
export function delay(ms = 250) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}