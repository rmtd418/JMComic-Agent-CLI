import { spawnSync } from "node:child_process";

const commands = [
  ["config", "--json"],
  ["discover", "--provider", "jm", "--query", "love", "--limit", "3", "--json"],
  ["resolve", "--provider", "jm", "--query", "love", "--limit", "3", "--json"],
  ["download", "--provider", "jm", "--id", "1429850", "--json"],
];

for (const args of commands) {
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
  process.stdout.write(`ok: ${args[0]}\n`);
}
