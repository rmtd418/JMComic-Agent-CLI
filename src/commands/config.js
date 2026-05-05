import { parseArgs } from "../shared/args.js";
import { successEnvelope, render } from "../shared/envelope.js";
import { authRoot, bundlePath, dataRoot, defaultOutputRoot, favoritesCachePath, projectRoot, sessionPath, stateRoot } from "../shared/paths.js";

export async function handleConfig(argv) {
  const { values } = parseArgs(argv);
  const payload = successEnvelope({
    command: "config",
    provider: null,
    request: { action: "show" },
    result: {
      phase: "shared-schema",
      status: "ready",
      defaults: {
        providers: ["jm"],
        provider_profiles: {
          jm: {
            provider_role: "primary",
            search_quality: "step2-mainline",
            download_reliability: "resume-ready",
            supports_resume_manifest: true,
            supports_failed_pages_retry: true,
            supports_external_images_dir: true,
          },
        },
        output_mode: "json",
        app_root: projectRoot(),
        data_root: dataRoot(),
        state_root: stateRoot(),
        output_root: defaultOutputRoot(),
        auth_storage: {
          auth_root: authRoot(),
          jm_session_path: sessionPath("jm"),
          jm_favorites_cache_path: favoritesCachePath("jm"),
          single_account: true,
          password_storage: "never",
        },
        jm_bridge: {
          mode: "in_process",
          bundle_path: bundlePath(),
        },
        jm_search: {
          page_size: 80,
          profile_pages: { fast: 1, balanced: 3, deep: 5 },
          profile_search_window: { fast: 80, balanced: 240, deep: 400 },
          profile_detail_workers: { fast: 6, balanced: 12, deep: 20 },
          default_report_limit: 10,
          default_chat_shortlist: 5,
          default_output_mode: "report",
          default_profile: "balanced",
        },
        implemented_commands: ["config", "auth", "library favorites", "discover", "resolve", "preview", "download", "package"],
        unsupported_providers: ["eh"],
      },
    },
  });
  return render(payload, Boolean(values.pretty));
}
