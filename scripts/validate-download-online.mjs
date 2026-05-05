import fs from "node:fs";
import { spawnSync } from "node:child_process";

function run(args) {
  const result = spawnSync(process.execPath, ["./bin/jm-agent.js", ...args], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  const payload = JSON.parse(result.stdout);
  if (!payload.ok) {
    process.stderr.write(result.stdout);
    process.exit(1);
  }
  return payload;
}

const first = run([
  "download",
  "--provider",
  "jm",
  "--id",
  "1429850",
  "--execute",
  "--page-limit",
  "1",
  "--skip-existing",
  "--json",
]);

if (!first.artifacts?.manifest_path || !fs.existsSync(first.artifacts.manifest_path)) {
  process.stderr.write("download manifest was not written\n");
  process.exit(1);
}

const resumed = run([
  "download",
  "--provider",
  "jm",
  "--resume-manifest",
  first.artifacts.manifest_path,
  "--execute",
  "--page-limit",
  "1",
  "--skip-existing",
  "--json",
]);

if (resumed.result?.resume_manifest !== first.artifacts.manifest_path) {
  process.stderr.write("resume manifest was not reflected in result\n");
  process.exit(1);
}

process.stdout.write(`ok: download ${first.artifacts.manifest_path}\n`);
process.stdout.write(`ok: resume ${resumed.artifacts.manifest_path}\n`);
