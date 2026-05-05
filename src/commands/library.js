import { loadSession } from "../auth-store.js";
import { asInt, parseArgs } from "../shared/args.js";
import { errorEnvelope, render, successEnvelope } from "../shared/envelope.js";
import { favorites, JmProviderError } from "../jm/provider.js";
import { buildQueryRequest } from "./query.js";

export async function handleLibrary(argv) {
  const subcommand = argv[0];
  const { values } = parseArgs(argv.slice(1));
  const provider = values.provider && values.provider !== true ? String(values.provider) : "jm";
  const query = buildQueryRequest(values);
  const request = {
    library_command: subcommand,
    provider,
    library: {
      source: subcommand,
      page: asInt(values.page, 1),
      folder_id: values["folder-id"] && values["folder-id"] !== true ? String(values["folder-id"]) : "0",
      query: query.scope.query,
      tags: query.scope.tags,
      ...query.filters,
      pick: query.selection.pick,
    },
  };
  if (provider !== "jm" || subcommand !== "favorites") {
    return render(errorEnvelope({
      command: "library",
      provider,
      request,
      error: {
        code: provider !== "jm" ? "PROVIDER_UNSUPPORTED" : "COMMAND_UNKNOWN",
        message: provider !== "jm" ? "Library only supports --provider jm." : "Only library favorites is implemented.",
        next_action: provider !== "jm" ? "Use --provider jm." : "Use library favorites.",
      },
    }), Boolean(values.pretty));
  }
  const session = loadSession("jm");
  if (!session?.jwt_token) {
    return render(errorEnvelope({ command: "library", provider: "jm", request, error: { code: "AUTH_REQUIRED", message: "JM favorites requires a saved session.", next_action: "Run auth login --provider jm." } }), Boolean(values.pretty));
  }
  try {
    const { result, warnings } = await favorites(request, session.jwt_token);
    return render(successEnvelope({ command: "library", provider: "jm", request, result, warnings }), Boolean(values.pretty));
  } catch (error) {
    const providerError = error instanceof JmProviderError ? error : new JmProviderError("BACKEND_ERROR", error instanceof Error ? error.message : String(error), "Retry the command.");
    return render(errorEnvelope({ command: "library", provider: "jm", request, error: { code: providerError.code, message: providerError.message, next_action: providerError.next_action } }), Boolean(values.pretty));
  }
}
