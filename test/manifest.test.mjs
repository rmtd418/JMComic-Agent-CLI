import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeManifest } from "../src/shared/manifest.js";

test("writeManifest writes a readable manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jm-agent-manifest-"));
  const artifacts = {
    output_root: root,
    task_root: root,
    manifest_path: path.join(root, "manifest.json"),
    images_dir: path.join(root, "images"),
    packages_dir: path.join(root, "packages"),
    reports_dir: path.join(root, "reports"),
  };
  const written = writeManifest({
    command: "download",
    provider: "jm",
    taskId: "download-fixed",
    request: { input: { item_id: "1" } },
    artifacts,
    status: "planned",
    summary: { download_ready: true },
  });
  const payload = JSON.parse(fs.readFileSync(written.path, "utf8"));
  assert.equal(payload.task_id, "download-fixed");
  assert.equal(payload.status, "planned");
});
