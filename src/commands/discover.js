import { parseArgs } from "../shared/args.js";
import { envelopeWithTaskId, errorEnvelope, newTaskId, render } from "../shared/envelope.js";
import { discover, JmProviderError } from "../jm/provider.js";
import { buildQueryRequest } from "./query.js";
import { defaultOutputRoot, newWorkspace } from "../shared/paths.js";
import { writeSearchReports } from "../reports.js";
import { writeManifest } from "../shared/manifest.js";

export async function handleDiscover(argv) {
  const { values } = parseArgs(argv);
  const provider = values.provider && values.provider !== true ? String(values.provider) : null;
  const request = buildQueryRequest(values);
  const taskId = newTaskId("discover");
  const artifacts = newWorkspace("discover", taskId, values["output-dir"] && values["output-dir"] !== true ? String(values["output-dir"]) : defaultOutputRoot());

  if (provider !== "jm") {
    const payload = errorEnvelope({
      command: "discover",
      provider,
      request,
      error: {
        code: "PROVIDER_UNSUPPORTED",
        message: "JS npm rewrite only supports --provider jm.",
        next_action: "Use --provider jm.",
      },
    });
    return render(payload, Boolean(values.pretty));
  }

  try {
    const { result, warnings } = await discover(request);
    writeSearchReports({ artifacts, command: "discover", result });
    const manifest = writeManifest({ command: "discover", provider: "jm", taskId, request, artifacts, status: result.status, summary: result, warnings });
    const payload = envelopeWithTaskId({
      ok: true,
      command: "discover",
      taskId,
      provider: "jm",
      request,
      artifacts,
      result,
      warnings: [...warnings, `Manifest written to ${manifest.path}`],
    });
    return render(payload, Boolean(values.pretty));
  } catch (error) {
    const providerError = error instanceof JmProviderError
      ? error
      : new JmProviderError("BACKEND_ERROR", error instanceof Error ? error.message : String(error), "Retry the command.");
    const payload = envelopeWithTaskId({
      ok: false,
      command: "discover",
      taskId,
      provider: "jm",
      request,
      artifacts,
      error: {
        code: providerError.code,
        message: providerError.message,
        next_action: providerError.next_action,
      },
    });
    return render(payload, Boolean(values.pretty));
  }
}
