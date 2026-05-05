import fs from "node:fs";
import path from "node:path";
import { favoritesCachePath } from "./shared/paths.js";

export function loadFavoritesCache(provider = "jm") {
  const target = favoritesCachePath(provider);
  if (!fs.existsSync(target)) {
    return { provider, folders: {}, items: {}, sync_runs: [] };
  }
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

export function saveFavoritesCache(cache, provider = "jm") {
  const target = favoritesCachePath(provider);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(cache, null, 2), "utf8");
  return target;
}
