import type { Challenge } from "./types";

type Challenges = Record<string, Challenge[]>;

// Steps' extra challenges are a large file that only step pages need, so it's a separate chunk
// that loads the first time a step page opens (and is saved for offline use like every asset).
let loaded: Challenges | null = null;
let pending: Promise<Challenges> | null = null;

export function challengesNow(): Challenges | null {
  return loaded;
}

export function loadChallenges(): Promise<Challenges> {
  pending ??= import("../generated/challenges.json").then((mod) => (loaded = mod.default as unknown as Challenges));
  return pending;
}
