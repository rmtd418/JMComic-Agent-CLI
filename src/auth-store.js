import fs from "node:fs";
import path from "node:path";
import { sessionPath } from "./shared/paths.js";

export function loadSession(provider) {
  const target = sessionPath(provider);
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

export function saveSession(provider, payload) {
  const target = sessionPath(provider);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 2), "utf8");
  return target;
}

export function clearSession(provider) {
  const target = sessionPath(provider);
  if (!fs.existsSync(target)) return false;
  fs.unlinkSync(target);
  return true;
}

export function maskUsername(value) {
  const text = String(value ?? "");
  if (!text) return null;
  if (text.length <= 4) return `${text[0] ?? ""}***`;
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}
