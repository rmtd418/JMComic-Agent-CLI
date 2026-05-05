import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("auth store saves and clears a session without password fields", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jm-agent-auth-"));
  const old = process.env.JM_AGENT_CLI_DATA_DIR;
  process.env.JM_AGENT_CLI_DATA_DIR = root;
  const store = await import(`../src/auth-store.js?case=${Date.now()}`);
  const saved = store.saveSession("jm", { provider: "jm", username: "user", jwt_token: "token" });
  const payload = store.loadSession("jm");
  assert.equal(payload.jwt_token, "token");
  assert.equal(payload.password, undefined);
  assert.equal(fs.existsSync(saved), true);
  assert.equal(store.clearSession("jm"), true);
  if (old === undefined) delete process.env.JM_AGENT_CLI_DATA_DIR;
  else process.env.JM_AGENT_CLI_DATA_DIR = old;
});
