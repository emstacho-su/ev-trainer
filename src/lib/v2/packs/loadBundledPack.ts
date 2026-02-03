/**
 * Overview: Loads and caches the bundled v2 spot pack from public assets.
 * Interacts with: filesystem and SpotPack parser/validator.
 * Importance: Single authoritative pack source for v2 session flows.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SpotPack } from "./spotPack";
import { parseSpotPack } from "./spotPack";

const PACK_PATH = "public/packs/ev-dev-pack-v1.json";
let cachedPack: SpotPack | null = null;

export function loadBundledPack(): SpotPack {
  if (cachedPack) return cachedPack;
  const packPath = resolve(process.cwd(), PACK_PATH);
  const raw = readFileSync(packPath, "utf-8");
  const json = JSON.parse(raw) as unknown;
  cachedPack = parseSpotPack(json);
  return cachedPack;
}

export function clearBundledPackCache(): void {
  cachedPack = null;
}
