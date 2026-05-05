import fs from "node:fs";
import path from "node:path";
import { utcNow } from "./envelope.js";

export function writeManifest({ command, provider, taskId, request, artifacts, status, summary, warnings = [] }) {
  const payload = {
    manifest_version: "0.1-js",
    task_id: taskId,
    command,
    provider,
    created_at: utcNow(),
    status,
    request,
    artifacts,
    summary,
    warnings,
  };
  fs.mkdirSync(path.dirname(artifacts.manifest_path), { recursive: true });
  fs.writeFileSync(artifacts.manifest_path, JSON.stringify(payload, null, 2), "utf8");
  return { path: artifacts.manifest_path, payload };
}
