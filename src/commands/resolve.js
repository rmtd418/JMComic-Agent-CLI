import { parseArgs } from "../shared/args.js";
import { envelopeWithTaskId, errorEnvelope, newTaskId, render } from "../shared/envelope.js";
import { resolve, JmProviderError } from "../jm/provider.js";
import { buildQueryRequest } from "./query.js";
import { defaultOutputRoot, newWorkspace } from "../shared/paths.js";
import { writeSearchReports } from "../reports.js";
import { writeManifest } from "../shared/manifest.js";

export async function handleResolve(argv) {
  const { values } = parseArgs(argv);
  const provider = values.provider && values.provider !== true ? String(values.provider) : null;
  const request = buildQueryRequest(values);
  const taskId = newTaskId("resolve");
  const artifacts = newWorkspace("resolve", taskId, values["output-dir"] && values["output-dir"] !== true ? String(values["output-dir"]) : defaultOutputRoot());
  if (provider !== "jm") {
    return render(errorEnvelope({
      command: "resolve",
      provider,
      request,
      error: { code: "PROVIDER_UNSUPPORTED", message: "JS npm rewrite only supports --provider jm.", next_action: "Use --provider jm." },
    }), Boolean(values.pretty));
  }
  try {
    const { result, warnings } = await resolve(request);
    writeSearchReports({ artifacts, command: "resolve", result: { ...result, shortlist: result.shortlist ?? (result.selected ? [result.selected] : []), returned_count: result.shortlist?.length ?? (result.selected ? 1 : 0), output_mode: request.filters.output_mode } });
    const manifest = writeManifest({ command: "resolve", provider: "jm", taskId, request, artifacts, status: result.status, summary: result, warnings });
    return render(envelopeWithTaskId({ ok: true, command: "resolve", taskId, provider: "jm", request, artifacts, result, warnings: [...warnings, `Manifest written to ${manifest.path}`] }), Boolean(values.pretty));
  } catch (error) {
    const providerError = error instanceof JmProviderError ? error : new JmProviderError("BACKEND_ERROR", error instanceof Error ? error.message : String(error), "Retry the command.");
    return render(envelopeWithTaskId({
      ok: false,
      command: "resolve",
      taskId,
      provider: "jm",
      request,
      artifacts,
      error: { code: providerError.code, message: providerError.message, next_action: providerError.next_action },
    }), Boolean(values.pretty));
  }
}
