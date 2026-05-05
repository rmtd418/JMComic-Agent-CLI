import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const srcDir = path.dirname(fileURLToPath(import.meta.url));

export function projectRoot() {
  return path.resolve(srcDir, "..", "..");
}

export function dataRoot() {
  if (process.env.JM_AGENT_CLI_DATA_DIR) {
    return path.resolve(process.env.JM_AGENT_CLI_DATA_DIR);
  }

  const candidates = [
    path.resolve(projectRoot(), "..", "JM Agent CLI Data"),
    path.resolve(process.cwd(), "JM Agent CLI Data"),
    path.resolve(process.cwd(), "..", "JM Agent CLI Data"),
  ];
  const usable = candidates.find((candidate) => fs.existsSync(candidate));
  return usable ?? candidates[1];
}

export function defaultOutputRoot() {
  return path.join(dataRoot(), "downloads");
}

export function stateRoot() {
  const root = path.join(dataRoot(), "state");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function authRoot() {
  const root = path.join(stateRoot(), "auth");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function sessionPath(provider) {
  return path.join(authRoot(), `${provider}.json`);
}

export function favoritesCachePath(provider = "jm") {
  return path.join(stateRoot(), `${provider}_favorites_cache.json`);
}

export function bundlePath() {
  return path.join(projectRoot(), "tools", "vendor", "JmComic.bundle.cjs");
}

export function sanitizeName(value, fallback = "item") {
  const cleaned = String(value ?? "")
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

export function newWorkspace(command, taskId, outputRoot = defaultOutputRoot()) {
  const taskRoot = path.join(path.resolve(outputRoot), command, taskId);
  const imagesDir = path.join(taskRoot, "images");
  const packagesDir = path.join(taskRoot, "packages");
  const reportsDir = path.join(taskRoot, "reports");
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(packagesDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });
  return {
    output_root: path.resolve(outputRoot),
    task_root: taskRoot,
    manifest_path: path.join(taskRoot, "manifest.json"),
    images_dir: imagesDir,
    packages_dir: packagesDir,
    reports_dir: reportsDir,
    package_targets: {},
    report_targets: {},
  };
}
