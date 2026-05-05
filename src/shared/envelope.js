import crypto from "node:crypto";

export function utcNow() {
  return new Date().toISOString();
}

export function newTaskId(command) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${command}-${stamp}-${crypto.randomUUID().slice(0, 8)}`;
}

export function envelopeWithTaskId({ ok, command, taskId, provider, request, result = {}, artifacts = null, warnings = [], error = null }) {
  const payload = {
    ok,
    command,
    task_id: taskId,
    timestamp: utcNow(),
    provider,
    request,
    result,
    warnings,
  };
  if (artifacts) {
    payload.artifacts = artifacts;
  }
  if (error) {
    payload.error = error;
  }
  return payload;
}

export function successEnvelope({ command, provider, request, result, warnings = [] }) {
  return {
    ok: true,
    command,
    task_id: newTaskId(command),
    timestamp: utcNow(),
    provider,
    request,
    result,
    warnings,
  };
}

export function errorEnvelope({ command, provider, request, error, warnings = [] }) {
  return {
    ok: false,
    command,
    task_id: newTaskId(command || "unknown"),
    timestamp: utcNow(),
    provider,
    request,
    result: {},
    warnings,
    error,
  };
}

export function render(payload, pretty) {
  const text = JSON.stringify(payload, null, 2);
  process.stdout.write(`${text}\n`);
  return payload.ok ? 0 : 2;
}
