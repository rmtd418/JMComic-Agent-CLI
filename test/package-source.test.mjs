import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolvePackageSource } from "../src/packaging.js";

test("resolvePackageSource reads image directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jm-agent-package-"));
  fs.writeFileSync(path.join(root, "0001.jpg"), Buffer.from([1, 2, 3]));
  const source = resolvePackageSource(root);
  assert.equal(source.input_kind, "directory");
  assert.equal(source.image_files.length, 1);
});

test("resolvePackageSource reads manifest images_dir", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jm-agent-package-manifest-"));
  const images = path.join(root, "images");
  fs.mkdirSync(images);
  fs.writeFileSync(path.join(images, "0001.png"), Buffer.from([1, 2, 3]));
  const manifest = path.join(root, "manifest.json");
  fs.writeFileSync(manifest, JSON.stringify({ task_id: "x", artifacts: { images_dir: images }, summary: { selected_item: { title: "Title" } } }));
  const source = resolvePackageSource(manifest);
  assert.equal(source.input_kind, "manifest");
  assert.equal(source.base_name, "Title");
  assert.equal(source.image_files.length, 1);
});
