import path from "node:path";
import { asArray, asInt, parseArgs } from "../shared/args.js";
import { envelopeWithTaskId, newTaskId, render } from "../shared/envelope.js";
import { writeManifest } from "../shared/manifest.js";
import { defaultOutputRoot, newWorkspace, sanitizeName } from "../shared/paths.js";
import { buildDownloadPlanFromAlbum, fetchAlbum, JmProviderError } from "../jm/provider.js";
import { executeJmDownload, DownloadExecutionError } from "../jm/download.js";
import { buildPackages, resolvePackageSource } from "../packaging.js";

export function expandPreviewIds(values) {
  const result = [];
  const seen = new Set();
  for (const value of asArray(values)) {
    for (const part of String(value).split(",")) {
      const id = part.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  return result;
}

function trimPlan(plan, pages) {
  let remaining = pages;
  return {
    ...plan,
    chapters: plan.chapters.map((chapter) => {
      const selected = remaining > 0 ? chapter.pages.slice(0, remaining) : [];
      remaining -= selected.length;
      return { ...chapter, pages: selected, page_count: selected.length };
    }).filter((chapter) => chapter.pages.length > 0),
    page_count: Math.min(plan.page_count, pages),
  };
}

function previewStatus(items) {
  if (items.every((item) => item.status === "completed")) return "completed";
  if (items.some((item) => item.status === "completed" || item.status === "partial_success")) return "partial_success";
  return "failed";
}

export async function handlePreview(argv) {
  const { values } = parseArgs(argv);
  const provider = values.provider && values.provider !== true ? String(values.provider) : "jm";
  const itemIds = expandPreviewIds(values.id);
  const pages = Math.max(1, asInt(values.pages, 3));
  const packageFormats = asArray(values.package).filter((item) => item !== true).map(String);
  const request = {
    input: {
      item_ids: itemIds,
      pages,
      package_formats: packageFormats,
      skip_existing: Boolean(values["skip-existing"]),
      allow_partial: Boolean(values["allow-partial"]),
      request_attempts: values["request-attempts"] ? asInt(values["request-attempts"], 3) : null,
      retry_delay_seconds: values["retry-delay"] ? Number.parseFloat(String(values["retry-delay"])) : null,
    },
  };
  const taskId = newTaskId("preview");
  const artifacts = newWorkspace("preview", taskId, values["output-dir"] && values["output-dir"] !== true ? String(values["output-dir"]) : defaultOutputRoot());

  if (provider !== "jm" || !itemIds.length) {
    return render(envelopeWithTaskId({
      ok: false,
      command: "preview",
      taskId,
      provider,
      request,
      artifacts,
      error: {
        code: provider !== "jm" ? "PROVIDER_UNSUPPORTED" : "INPUT_REQUIRED",
        message: provider !== "jm" ? "JS npm rewrite only supports --provider jm." : "Preview requires at least one --id.",
        next_action: provider !== "jm" ? "Use --provider jm." : "Provide --id.",
      },
    }), Boolean(values.pretty));
  }

  const items = [];
  const warnings = [];
  try {
    for (const [index, id] of itemIds.entries()) {
      const album = await fetchAlbum(id);
      const plan = trimPlan(await buildDownloadPlanFromAlbum(album), pages);
      const itemDir = path.join(artifacts.images_dir, `${String(index + 1).padStart(2, "0")}-${sanitizeName(id)}`);
      const execution = await executeJmDownload(plan, itemDir, {
        maxPages: pages,
        skipExisting: Boolean(values["skip-existing"]),
        allowPartial: Boolean(values["allow-partial"]),
        requestAttempts: values["request-attempts"] ? asInt(values["request-attempts"], 3) : 3,
        retryDelaySeconds: values["retry-delay"] ? Number.parseFloat(String(values["retry-delay"])) : 1.5,
      });
      items.push({
        id,
        title: plan.title,
        status: execution.status,
        image_count: execution.image_count,
        images_dir: execution.images_dir,
        cover_path: execution.cover_path,
        failed_count: execution.failed_count,
      });
    }

    if (packageFormats.length) {
      const source = resolvePackageSource(artifacts.images_dir);
      const packaged = await buildPackages(source, packageFormats, artifacts.packages_dir);
      artifacts.package_targets = packaged.targets;
      warnings.push(...packaged.warnings);
    }

    const status = previewStatus(items);
    const summary = { mode: itemIds.length > 1 ? "preview_by_id_batch" : "preview_by_id", item_count: items.length, requested_pages: pages, items, package_formats: packageFormats };
    const manifest = writeManifest({ command: "preview", provider: "jm", taskId, request, artifacts, status, summary, warnings });
    return render(envelopeWithTaskId({
      ok: true,
      command: "preview",
      taskId,
      provider: "jm",
      request,
      artifacts,
      result: { phase: "provider", status, preview_ready: true, requested_pages: pages, item_count: items.length, items, package_formats: packageFormats },
      warnings: [...warnings, `Manifest written to ${manifest.path}`],
    }), Boolean(values.pretty));
  } catch (error) {
    const code = error instanceof JmProviderError || error instanceof DownloadExecutionError ? error.code : "BACKEND_ERROR";
    const nextAction = error.next_action ?? "Retry the command.";
    return render(envelopeWithTaskId({
      ok: false,
      command: "preview",
      taskId,
      provider: "jm",
      request,
      artifacts,
      error: { code, message: error instanceof Error ? error.message : String(error), next_action: nextAction },
      warnings,
    }), Boolean(values.pretty));
  }
}
