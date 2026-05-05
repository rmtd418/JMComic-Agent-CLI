import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["./bin/jm-agent.js", "library", "favorites", "--provider", "jm", "--limit", "5", "--json"], {
  encoding: "utf8",
  timeout: 120000,
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
