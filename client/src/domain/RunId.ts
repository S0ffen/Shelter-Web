/** UUID v4 for checkpoints, including ordinary HTTP origins used for LAN demos. */
export function createRunId(): string {
  const random = globalThis.crypto;
  if (typeof random?.randomUUID === 'function') return random.randomUUID();
  // getRandomValues also works on HTTP LAN origins where randomUUID is unavailable.
  if (typeof random?.getRandomValues !== 'function')
    throw new Error('This browser cannot generate run identifiers. Use an up-to-date Chrome or Edge.');
  const bytes = random.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
