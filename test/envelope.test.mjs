import test from "node:test";
import assert from "node:assert/strict";
import { errorEnvelope, envelopeWithTaskId, successEnvelope } from "../src/shared/envelope.js";

test("successEnvelope creates agent JSON envelope", () => {
  const payload = successEnvelope({ command: "config", provider: null, request: {}, result: { status: "ready" } });
  assert.equal(payload.ok, true);
  assert.equal(payload.command, "config");
  assert.equal(payload.result.status, "ready");
  assert.match(payload.task_id, /^config-/);
});

test("errorEnvelope includes error detail", () => {
  const payload = errorEnvelope({ command: "discover", provider: "jm", request: {}, error: { code: "X", message: "failed" } });
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "X");
});

test("envelopeWithTaskId preserves caller task id", () => {
  const payload = envelopeWithTaskId({ ok: true, command: "preview", taskId: "preview-fixed", provider: "jm", request: {} });
  assert.equal(payload.task_id, "preview-fixed");
});
