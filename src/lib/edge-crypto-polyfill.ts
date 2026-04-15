// Polyfill for node:crypto on the Edge runtime
const crypto = globalThis.crypto;
export default crypto;
export const {
  getRandomValues,
  subtle,
  randomUUID,
} = crypto;
