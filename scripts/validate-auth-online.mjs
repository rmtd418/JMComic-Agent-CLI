import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["./bin/jm-agent.js", "auth", "status", "--provider", "jm", "--json"], {
  encoding: "utf8",
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
