// Moving progress between devices without a server:
//  - a transfer link (progress compressed into the address, also shown as a QR code)
//  - an optional private GitHub Gist, using a token the learner creates
import { exportProgress, getState, mergeStates, parseProgress, subscribe, update, type State } from "../state/store";

// ------------------------------------------------------------ transfer link
const toB64url = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** The progress without saved code (code can be large; the Gist keeps it). */
function slim(s: State): State {
  const steps: State["steps"] = {};
  for (const [id, st] of Object.entries(s.steps)) {
    if (!st.done && !st.hintsUsed) continue;
    steps[id] = { done: st.done, hintsUsed: st.hintsUsed, clean: st.clean, doneAt: st.doneAt };
  }
  const projects: State["projects"] = {};
  for (const [id, p] of Object.entries(s.projects)) projects[id] = { milestone: p.milestone, completed: p.completed, code: "" };
  return { ...s, steps, projects };
}

export async function makeTransferLink(): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(slim(getState())));
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  return `${location.origin}${import.meta.env.BASE_URL}profile#transfer=${toB64url(packed)}`;
}

export async function readTransfer(code: string): Promise<State> {
  const bytes = await pipe(fromB64url(code), new DecompressionStream("deflate-raw"));
  return parseProgress(new TextDecoder().decode(bytes));
}

/** A QR code as SVG markup, or null when the link is too long to fit in one. */
export async function qrSvg(text: string): Promise<string | null> {
  if (text.length > 2900) return null;
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "L");
  qr.addData(text, "Byte");
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
}

// ------------------------------------------------------------ GitHub Gist
const GIST_KEY = "cpp-arena-gist";
const FILE = "cpp-arena-progress.json";
type GistConfig = { token: string; id?: string; auto: boolean; last?: number };

export function gistConfig(): GistConfig | null {
  try {
    const raw = localStorage.getItem(GIST_KEY);
    return raw ? (JSON.parse(raw) as GistConfig) : null;
  } catch {
    return null;
  }
}
function setConfig(c: GistConfig | null) {
  try {
    if (c) localStorage.setItem(GIST_KEY, JSON.stringify(c));
    else localStorage.removeItem(GIST_KEY);
  } catch {
    /* storage blocked */
  }
}
export function setGistToken(token: string, auto: boolean) {
  const prev = gistConfig();
  setConfig({ token: token.trim(), id: prev?.token === token.trim() ? prev.id : undefined, auto });
}
export function setGistAuto(auto: boolean) {
  const c = gistConfig();
  if (c) setConfig({ ...c, auto });
}
export function forgetGist() {
  setConfig(null);
}

async function api(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (r.status === 401) throw new Error("GitHub rejected the token. Check it hasn't expired and has the gist permission.");
  if (r.status === 403 || r.status === 404) throw new Error("The token can't reach your gists. Make sure it has the gist permission.");
  if (!r.ok) throw new Error(`GitHub answered ${r.status}.`);
  return r.json();
}

async function findGist(c: GistConfig): Promise<string | undefined> {
  if (c.id) return c.id;
  for (let page = 1; page <= 5; page++) {
    const list = (await api(`/gists?per_page=100&page=${page}`, c.token)) as { id: string; files: Record<string, unknown> }[];
    const hit = list.find((g) => FILE in g.files);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return undefined;
}

/** Download the saved progress (if any) and merge it into this browser. Returns false when nothing was saved yet. */
export async function loadFromGist(): Promise<boolean> {
  const c = gistConfig();
  if (!c) throw new Error("Add a GitHub token first.");
  const id = await findGist(c);
  if (!id) return false;
  const g = (await api(`/gists/${id}`, c.token)) as { files: Record<string, { content?: string; truncated?: boolean; raw_url: string }> };
  const f = g.files[FILE];
  if (!f) return false;
  const text = f.truncated || f.content == null ? await (await fetch(f.raw_url)).text() : f.content;
  const incoming = parseProgress(text);
  update((s) => mergeStates(s, incoming));
  setConfig({ ...c, id, last: Date.now() });
  return true;
}

/** Upload this browser's progress to the private gist (creating it the first time). */
export async function saveToGist(): Promise<void> {
  const c = gistConfig();
  if (!c) throw new Error("Add a GitHub token first.");
  const id = await findGist(c);
  const body = JSON.stringify({ description: "C/C++ Arena progress (cpparena.com)", files: { [FILE]: { content: exportProgress() } }, ...(id ? {} : { public: false }) });
  const g = (await api(id ? `/gists/${id}` : "/gists", c.token, { method: id ? "PATCH" : "POST", body })) as { id: string };
  setConfig({ ...c, id: g.id, last: Date.now() });
}

export type SyncStatus = { state: "idle" | "syncing" | "ok" | "error"; message: string };
let status: SyncStatus = { state: "idle", message: "" };
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  status = s;
  statusListeners.forEach((l) => l());
}
export const syncStatus = {
  get: () => status,
  subscribe: (fn: () => void) => {
    statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  },
};

let started = false;
/**
 * With automatic sync on: merge from the gist when the site opens, then save a
 * minute after progress changes (and when the tab is hidden).
 */
export function startAutoSync() {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  const save = async () => {
    if (!dirty || !gistConfig()?.auto) return;
    dirty = false;
    try {
      setStatus({ state: "syncing", message: "Saving to your gist" });
      await saveToGist();
      setStatus({ state: "ok", message: "Saved to your gist" });
    } catch (e) {
      setStatus({ state: "error", message: (e as Error).message });
    }
  };
  const c = gistConfig();
  if (c?.auto) {
    setStatus({ state: "syncing", message: "Loading from your gist" });
    loadFromGist()
      .then(() => setStatus({ state: "ok", message: "Up to date with your gist" }))
      .catch((e) => setStatus({ state: "error", message: (e as Error).message }));
  }
  subscribe(() => {
    if (!gistConfig()?.auto) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 60_000);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void save();
  });
}
