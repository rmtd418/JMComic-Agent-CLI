import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("config reports implemented JM reliability capabilities", () => {
  const result = spawnSync(process.execPath, ["./bin/jm-agent.js", "config", "--json"], {
    encoding: "utf8",
    shell: false,
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  const jm = payload.result.defaults.provider_profiles.jm;

  assert.equal(jm.supports_resume_manifest, true);
  assert.equal(jm.supports_failed_pages_retry, true);
  assert.equal(jm.supports_external_images_dir, true);
  assert.equal(jm.download_reliability, "resume-ready");
});
