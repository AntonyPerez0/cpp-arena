// Packs text into a short, URL-safe string (deflate + base64url), for links that carry data
// in the address: progress transfer links and shared playground code.
export const toB64url = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function packText(text: string): Promise<string> {
  return toB64url(await pipe(new TextEncoder().encode(text), new CompressionStream("deflate-raw")));
}

export async function unpackText(packed: string): Promise<string> {
  return new TextDecoder().decode(await pipe(fromB64url(packed), new DecompressionStream("deflate-raw")));
}
