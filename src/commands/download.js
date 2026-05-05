import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../shared/args.js";
import { envelopeWithTaskId, newTaskId, render } from "../shared/envelope.js";
import { writeManifest } from "../shared/manifest.js";
import { defaultOutputRoot, newWorkspace } from "../shared/paths.js";
import { downloadPlan, JmProviderError } from "../jm/provider.js";
import { executeJmDownload, DownloadExecutionError } from "../jm/download.js";
import { buildDownloadInput } from "./query.js";

export function loadResumeManifest(manifestPath) {
  const resolved = path.resolve(manifestPath);
  const payload = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const plan = payload.summary?.download_plan;
  if (!plan) {
    throw new DownloadExecutionError("INPUT_INVALID", `Resume manifest does not include summary.download_plan: ${resolved}`, "Provide a download manifest.");
  }
  return { path: resolved, payload, plan };
}

export function filterPlanToFailedPages(downloadPlanValue, failedPages) {
  const wanted = new Set((failedPages ?? []).map((page) => `${page.chapter_id || ""}:${page.index}`));
  return {
    ...downloadPlanValue,
    chapters: (downloadPlanValue.chapters ?? []).map((chapter) => ({
      ...chapter,
      pages: (chapter.pages ?? []).filter((page) => wanted.has(`${page.chapter_id || chapter.id}:${page.index}`)),
    })).filter((chapter) => chapter.pages.length),
  };
}

export async function handleDownload(argv) {
  const { values } = parseArgs(argv);
  const provider = values.provider && values.provider !== true ? String(values.provider) : null;
  const input = buildDownloadInput(values);
  const request = { input, execute: Boolean(values.execute) };
  const taskId = newTaskId("download");
  const artifacts = newWorkspace("download", taskId, values["output-dir"] && values["output-dir"] !== true ? String(values["output-dir"]) : defaultOutputRoot());
  if (input.images_dir) {
    artifacts.images_dir = path.resolve(input.images_dir);
    fs.mkdirSync(artifacts.images_dir, { recursive: true });
  }

  if (provider !== "jm" || (!input.item_id && !input.query && !input.tags.length && !input.resume_manifest)) {
    return render(envelopeWithTaskId({
      ok: false,
      command: "download",
      taskId,
      provider,
      request,
      artifacts,
      error: {
        code: provider !== "jm" ? "PROVIDER_UNSUPPORTED" : "INPUT_REQUIRED",
        message: provider !== "jm" ? "JS npm rewrite only supports --provider jm." : "Download requires --id, --query, --tag, or --resume-manifest.",
        next_action: provider !== "jm" ? "Use --provider jm." : "Provide a target id or query.",
      },
    }), Boolean(values.pretty));
  }

  let planned = null;
  let warnings = [];
  try {
    if (input.resume_manifest) {
      const resume = loadResumeManifest(input.resume_manifest);
      if (!input.images_dir && resume.payload.artifacts?.images_dir) {
        artifacts.images_dir = path.resolve(resume.payload.artifacts.images_dir);
        fs.mkdirSync(artifacts.images_dir, { recursive: true });
      }
      const previousExecution = resume.payload.summary?.execution ?? {};
      const activePlan = input.failed_pages_only ? filterPlanToFailedPages(resume.plan, previousExecution.failed_pages ?? []) : resume.plan;
      planned = {
        result: {
          phase: "provider",
          status: "planned",
          provider: "jm",
          selected: resume.payload.summary?.selected_item ?? null,
          download_ready: true,
          chapter_count: activePlan.chapters?.length ?? 0,
          page_count: (activePlan.chapters ?? []).reduce((sum, chapter) => sum + (chapter.pages?.length ?? 0), 0),
          cover_url: activePlan.cover_url,
        },
        summary: {
          mode: "resume_manifest",
          selected_count: 1,
          download_ready: true,
          selected_item: resume.payload.summary?.selected_item ?? null,
          download_plan: activePlan,
          resume: {
            manifest_path: resume.path,
            failed_pages_only: input.failed_pages_only,
          },
        },
        warnings: [`Resumed from manifest ${resume.path}`],
      };
    } else {
      planned = await downloadPlan(input);
    }
    warnings = planned.warnings;
    let status = "planned";
    const result = {
      ...planned.result,
      execution_mode: values.execute ? "executed" : "plan_only",
      plan_saved: true,
      executed: Boolean(values.execute),
    };
    if (values.execute) {
      const execution = await executeJmDownload(planned.summary.download_plan, artifacts.images_dir, {
        maxPages: input.execution_page_limit,
        skipExisting: input.skip_existing,
        allowPartial: input.allow_partial,
        requestAttempts: input.request_attempts ?? 3,
        retryDelaySeconds: input.retry_delay_seconds ?? 1.5,
      });
      planned.summary.execution = execution;
      status = execution.status;
      Object.assign(result, {
        status: execution.status,
        image_count: execution.image_count,
        images_dir: execution.images_dir,
        skipped_count: execution.skipped_count,
        failed_count: execution.failed_count,
        failed_pages_preview: execution.failed_pages.slice(0, 5),
        max_pages_applied: execution.max_pages_applied,
        request_attempts: execution.request_attempts,
        retry_delay_seconds: input.retry_delay_seconds ?? 1.5,
        resume_manifest: input.resume_manifest,
      });
    }
    const manifest = writeManifest({ command: "download", provider: "jm", taskId, request, artifacts, status, summary: planned.summary, warnings });
    return render(envelopeWithTaskId({
      ok: true,
      command: "download",
      taskId,
      provider: "jm",
      request,
      artifacts,
      result,
      warnings: [...warnings, `Manifest written to ${manifest.path}`],
    }), Boolean(values.pretty));
  } catch (error) {
    const code = error instanceof JmProviderError || error instanceof DownloadExecutionError ? error.code : "BACKEND_ERROR";
    const details = error instanceof DownloadExecutionError ? error.details : null;
    if (planned?.summary && details) {
      planned.summary.execution = details;
      writeManifest({ command: "download", provider: "jm", taskId, request, artifacts, status: "failed", summary: planned.summary, warnings });
    }
    return render(envelopeWithTaskId({
      ok: false,
      command: "download",
      taskId,
      provider: "jm",
      request,
      artifacts,
      error: { code, message: error instanceof Error ? error.message : String(error), next_action: error.next_action ?? "Retry the command." },
      warnings,
    }), Boolean(values.pretty));
  }
}
