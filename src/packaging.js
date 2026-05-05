import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { sanitizeName } from "./shared/paths.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);

export class PackagingError extends Error {
  constructor(code, message, nextAction = null) {
    super(message);
    this.name = "PackagingError";
    this.code = code;
    this.next_action = nextAction;
  }
}

function collectImages(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) return [];
  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase()) ? [resolved] : [];
  }
  const results = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) results.push(full);
    }
  };
  visit(resolved);
  return results.sort((a, b) => a.localeCompare(b));
}

export function resolvePackageSource(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new PackagingError("INPUT_NOT_FOUND", `Packaging input was not found: ${resolved}`, "Provide an existing directory or manifest path.");
  }
  if (fs.statSync(resolved).isFile() && path.extname(resolved).toLowerCase() === ".json") {
    const manifest = JSON.parse(fs.readFileSync(resolved, "utf8"));
    const imagesRoot = manifest.artifacts?.images_dir;
    if (!imagesRoot) {
      throw new PackagingError("INPUT_INVALID", `Manifest does not include artifacts.images_dir: ${resolved}`, "Provide a download manifest or direct image directory.");
    }
    const title = manifest.summary?.selected_item?.title ?? manifest.task_id ?? path.basename(resolved, ".json");
    return {
      input_kind: "manifest",
      source_path: resolved,
      images_root: path.resolve(imagesRoot),
      image_files: collectImages(imagesRoot),
      base_name: sanitizeName(title, "package"),
      source_manifest: manifest,
    };
  }
  const stat = fs.statSync(resolved);
  const imagesRoot = stat.isFile() ? path.dirname(resolved) : resolved;
  return {
    input_kind: stat.isFile() ? "file" : "directory",
    source_path: resolved,
    images_root: imagesRoot,
    image_files: collectImages(resolved),
    base_name: sanitizeName(stat.isFile() ? path.basename(resolved, path.extname(resolved)) : path.basename(resolved), "package"),
    source_manifest: null,
  };
}

function buildZip(files, root, target) {
  const zip = new AdmZip();
  for (const file of files) {
    let arcname = path.relative(root, file);
    if (arcname.startsWith("..")) arcname = path.basename(file);
    zip.addLocalFile(file, path.dirname(arcname) === "." ? "" : path.dirname(arcname), path.basename(arcname));
  }
  zip.writeZip(target);
}

async function buildPdf(files, target) {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
  const stream = fs.createWriteStream(target);
  doc.pipe(stream);
  for (const file of files) {
    const png = await sharp(file).rotate().png().toBuffer();
    const meta = await sharp(png).metadata();
    doc.addPage({ size: [meta.width, meta.height], margin: 0 });
    doc.image(png, 0, 0, { width: meta.width, height: meta.height });
  }
  doc.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

export async function buildPackages(source, formats, packagesDir) {
  if (!source.image_files.length) {
    throw new PackagingError("NO_IMAGES", `No image files were found in packaging input: ${source.images_root}`, "Populate the images directory or pass a different input.");
  }
  fs.mkdirSync(packagesDir, { recursive: true });
  const produced = {};
  const targets = {};
  for (const format of formats) {
    const extension = format === "cbz" ? "cbz" : format;
    const target = path.join(packagesDir, `${source.base_name}.${extension}`);
    if (format === "zip" || format === "cbz") {
      buildZip(source.image_files, source.images_root, target);
    } else if (format === "pdf") {
      await buildPdf(source.image_files, target);
    } else {
      throw new PackagingError("UNSUPPORTED", `Unsupported package format: ${format}`, "Use cbz, zip, or pdf.");
    }
    targets[format] = target;
    produced[format] = { path: target, size_bytes: fs.statSync(target).size };
  }
  return {
    targets,
    summary: {
      input_kind: source.input_kind,
      source_path: source.source_path,
      images_root: source.images_root,
      image_count: source.image_files.length,
      formats,
      produced,
      source_manifest_task_id: source.source_manifest?.task_id ?? null,
    },
    warnings: source.input_kind === "manifest" ? ["Packaging input was resolved from an existing manifest."] : [],
  };
}
