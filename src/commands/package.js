import { asArray, parseArgs } from "../shared/args.js";
import { envelopeWithTaskId, newTaskId, render } from "../shared/envelope.js";
import { writeManifest } from "../shared/manifest.js";
import { defaultOutputRoot, newWorkspace } from "../shared/paths.js";
import { buildPackages, PackagingError, resolvePackageSource } from "../packaging.js";

export async function handlePackage(argv) {
  const { values } = parseArgs(argv);
  const formats = asArray(values.format).filter((format) => format !== true).map(String);
  const selectedFormats = formats.length ? formats : ["cbz", "pdf"];
  const inputPath = values.input && values.input !== true ? String(values.input) : null;
  const request = { input_path: inputPath, formats: selectedFormats };
  const taskId = newTaskId("package");
  const artifacts = newWorkspace("package", taskId, values["output-dir"] && values["output-dir"] !== true ? String(values["output-dir"]) : defaultOutputRoot());

  if (!inputPath) {
    return render(envelopeWithTaskId({
      ok: false,
      command: "package",
      taskId,
      provider: null,
      request,
      artifacts,
      error: { code: "INPUT_REQUIRED", message: "Package requires --input.", next_action: "Provide an image directory or manifest path." },
    }), Boolean(values.pretty));
  }

  try {
    const source = resolvePackageSource(inputPath);
    const packaged = await buildPackages(source, selectedFormats, artifacts.packages_dir);
    artifacts.package_targets = packaged.targets;
    const manifest = writeManifest({ command: "package", provider: null, taskId, request, artifacts, status: "completed", summary: packaged.summary, warnings: packaged.warnings });
    return render(envelopeWithTaskId({
      ok: true,
      command: "package",
      taskId,
      provider: null,
      request,
      artifacts,
      result: { phase: "provider", status: "completed", package_ready: true, image_count: packaged.summary.image_count, formats: selectedFormats, produced: packaged.summary.produced },
      warnings: [...packaged.warnings, `Manifest written to ${manifest.path}`],
    }), Boolean(values.pretty));
  } catch (error) {
    const packagingError = error instanceof PackagingError ? error : new PackagingError("BACKEND_ERROR", error instanceof Error ? error.message : String(error), "Retry the command.");
    return render(envelopeWithTaskId({
      ok: false,
      command: "package",
      taskId,
      provider: null,
      request,
      artifacts,
      error: { code: packagingError.code, message: packagingError.message, next_action: packagingError.next_action },
    }), Boolean(values.pretty));
  }
}
