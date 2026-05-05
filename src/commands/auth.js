import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { clearSession, loadSession, maskUsername, saveSession } from "../auth-store.js";
import { parseArgs } from "../shared/args.js";
import { errorEnvelope, render, successEnvelope } from "../shared/envelope.js";
import { sessionPath } from "../shared/paths.js";
import { login, validateSession, JmProviderError } from "../jm/provider.js";

async function promptMissingCredentials(values) {
  let username = values.username && values.username !== true ? String(values.username) : process.env.JM_AGENT_USERNAME;
  let password = values.password && values.password !== true ? String(values.password) : process.env.JM_AGENT_PASSWORD;
  if (username && password) return { username, password };
  const rl = readline.createInterface({ input, output });
  try {
    if (!username) username = await rl.question("User Name: ");
    if (!password) password = await rl.question("Password : ");
  } finally {
    rl.close();
  }
  return { username, password };
}

export async function handleAuth(argv) {
  const subcommand = argv[0];
  const { values } = parseArgs(argv.slice(1));
  const provider = values.provider && values.provider !== true ? String(values.provider) : "jm";
  const request = { auth_command: subcommand, provider };
  if (provider !== "jm") {
    return render(errorEnvelope({ command: "auth", provider, request, error: { code: "PROVIDER_UNSUPPORTED", message: "Auth only supports --provider jm.", next_action: "Use --provider jm." } }), Boolean(values.pretty));
  }

  try {
    if (subcommand === "login") {
      const { username, password } = await promptMissingCredentials(values);
      const session = await login(username, password);
      const savedPath = saveSession("jm", session);
      return render(successEnvelope({
        command: "auth",
        provider: "jm",
        request,
        result: {
          phase: "provider",
          status: "authenticated",
          provider: "jm",
          username: maskUsername(username),
          session_kind: "jwt",
          session_path: savedPath,
          password_storage: "never",
        },
      }), Boolean(values.pretty));
    }
    if (subcommand === "status") {
      const session = loadSession("jm");
      if (!session?.jwt_token) {
        return render(errorEnvelope({ command: "auth", provider: "jm", request, error: { code: "AUTH_REQUIRED", message: "No JM session is saved.", next_action: "Run auth login --provider jm." } }), Boolean(values.pretty));
      }
      const status = await validateSession(session.jwt_token);
      return render(successEnvelope({
        command: "auth",
        provider: "jm",
        request,
        result: {
          ...status,
          username: maskUsername(session.username),
          session_path: sessionPath("jm"),
        },
      }), Boolean(values.pretty));
    }
    if (subcommand === "logout") {
      const removed = clearSession("jm");
      return render(successEnvelope({
        command: "auth",
        provider: "jm",
        request,
        result: { phase: "provider", status: "logged_out", removed, session_path: sessionPath("jm") },
      }), Boolean(values.pretty));
    }
    return render(errorEnvelope({ command: "auth", provider: "jm", request, error: { code: "COMMAND_UNKNOWN", message: "Unknown auth command.", next_action: "Use login, status, or logout." } }), Boolean(values.pretty));
  } catch (error) {
    const providerError = error instanceof JmProviderError ? error : new JmProviderError("BACKEND_ERROR", error instanceof Error ? error.message : String(error), "Retry the command.");
    return render(errorEnvelope({ command: "auth", provider: "jm", request, error: { code: providerError.code, message: providerError.message, next_action: providerError.next_action } }), Boolean(values.pretty));
  }
}
