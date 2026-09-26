// public/toolchain/manifest.json (written by scripts/copy-toolchain.mjs), shared by the
// page and the compiler worker.

/** `files`: full sizes. `gzip`: sizes of the .gz copies, fetched instead when the browser can unpack them. */
export type Manifest = { version: string; files: Record<string, number>; gzip?: Record<string, number> };

/** Each toolchain version is saved in its own Cache Storage cache: this prefix plus the version. */
export const CACHE_PREFIX = "cpp-arena-toolchain-";

/**
 * The server's manifest, or without a connection, the copy the compiler worker saved next to
 * a fully downloaded toolchain, so a compiler that's already saved also starts offline.
 */
export async function fetchManifest(url: string): Promise<Manifest | null> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (res.ok) return (await res.json()) as Manifest;
  } catch {
    /* offline: use the saved copy */
  }
  try {
    for (const k of await caches.keys()) {
      if (!k.startsWith(CACHE_PREFIX)) continue;
      const hit = await (await caches.open(k)).match(url);
      if (hit) return (await hit.json()) as Manifest;
    }
  } catch {
    /* no Cache Storage (private mode) */
  }
  return null;
}
