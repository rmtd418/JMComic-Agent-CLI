import { handleConfig } from "./commands/config.js";
import { handleAuth } from "./commands/auth.js";
import { handleDiscover } from "./commands/discover.js";
import { handleDownload } from "./commands/download.js";
import { handleLibrary } from "./commands/library.js";
import { handlePackage } from "./commands/package.js";
import { handlePreview } from "./commands/preview.js";
import { handleResolve } from "./commands/resolve.js";
import { errorEnvelope, render } from "./shared/envelope.js";

const COMMANDS = new Map([
  ["config", handleConfig],
  ["auth", handleAuth],
  ["library", handleLibrary],
  ["discover", handleDiscover],
  ["resolve", handleResolve],
  ["preview", handlePreview],
  ["download", handleDownload],
  ["package", handlePackage],
]);

function helpText() {
  return [
    "jm-agent",
    "",
    "Commands:",
    "  config --json",
    "  auth login|status|logout --provider jm --json",
    "  library favorites --provider jm [--limit <n>] --json",
    "  discover --provider jm --query <text> [--tag <tag>] [--limit <n>] --json",
    "  resolve --provider jm --query <text> [--tag <tag>] [--limit <n>] --json",
    "  preview --provider jm --id <id> [--pages <n>] [--package pdf] --json",
    "  download --provider jm (--id <id> | --query <text>) [--execute] --json",
    "  package --input <dir|manifest.json> --format cbz --format pdf --json",
  ].join("\n");
}

export async function main(argv) {
  const command = argv[0];
  if (!command || command === "-h" || command === "--help") {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }

  const handler = COMMANDS.get(command);
  if (!handler) {
    const payload = errorEnvelope({
      command,
      provider: null,
      request: { argv },
      error: {
        code: "COMMAND_UNKNOWN",
        message: `Unknown command: ${command}`,
        next_action: "Use config, discover, resolve, preview, download, or package.",
      },
    });
    render(payload, false);
    return 2;
  }

  return handler(argv.slice(1));
}
