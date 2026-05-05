import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { sanitizeName } from "../shared/paths.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export class DownloadExecutionError extends Error {
  constructor(code, message, nextAction = null, details = null) {
    super(message);
    this.name = "DownloadExecutionError";
    this.code = code;
    this.next_action = nextAction;
    this.details = details;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionFromUrl(url, fallback = ".jpg") {
  try {
    const suffix = path.extname(new URL(url).pathname).toLowerCase();
    return IMAGE_EXTENSIONS.has(suffix) ? suffix : fallback;
  } catch {
    return fallback;
  }
}

function chapterDir(imagesRoot, chapter, chapterCount) {
  if (chapterCount <= 1) {
    return imagesRoot;
  }
  return path.join(imagesRoot, `${sanitizeName(chapter.sort || "1")}-${sanitizeName(chapter.title || chapter.id || "chapter")}`);
}

function segmentationNum(chapterId, scrambleId, pictureName) {
  const stem = path.parse(pictureName).name;
  if (chapterId < scrambleId) return 0;
  if (chapterId < 268850) return 10;
  const lastChar = crypto.createHash("md5").update(`${chapterId}${stem}`, "utf8").digest("hex").at(-1);
  const lastValue = lastChar.charCodeAt(0);
  if (chapterId > 421926) return (lastValue % 8) * 2 + 2;
  return (lastValue % 10) * 2 + 2;
}

async function descrambleToPng(data, chapterId, pictureName, scrambleId) {
  const segments = segmentationNum(chapterId, scrambleId, pictureName);
  const source = sharp(data).ensureAlpha();
  const meta = await source.metadata();
  if (!meta.width || !meta.height || segments <= 1) {
    return sharp(data).png().toBuffer();
  }
  const base = Math.floor(meta.height / segments);
  const remainder = meta.height % segments;
  const composites = [];
  let targetTop = 0;
  for (let sourceIndex = segments - 1; sourceIndex >= 0; sourceIndex -= 1) {
    const top = sourceIndex * base;
    const height = base + (sourceIndex === segments - 1 ? remainder : 0);
    const input = await sharp(data)
      .extract({ left: 0, top, width: meta.width, height })
      .png()
      .toBuffer();
    composites.push({ input, left: 0, top: targetTop });
    targetTop += height;
  }
  return sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function downloadBytes(url, { attempts = 3, retryDelaySeconds = 1.5, referer = null } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          ...(referer ? { Referer: referer } : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await sleep(Math.max(0, retryDelaySeconds) * 1000);
      }
    }
  }
  throw new DownloadExecutionError("NETWORK_ERROR", `Failed to download resource after ${attempts} attempts: ${url}`, "Retry the download or use --skip-existing.", { url, cause: lastError?.message });
}

function snapshot({ status, imagesRoot, pageRecords, skippedRecords, failedPages, coverPath, maxPages, requestAttempts }) {
  return {
    provider: "jm",
    status,
    image_count: pageRecords.length,
    skipped_count: skippedRecords.length,
    failed_count: failedPages.length,
    images_dir: imagesRoot,
    cover_path: coverPath,
    downloaded_files: pageRecords,
    skipped_files: skippedRecords,
    failed_pages: failedPages,
    max_pages_applied: maxPages ?? null,
    request_attempts: requestAttempts,
  };
}

export async function executeJmDownload(downloadPlan, imagesRoot, options = {}) {
  const maxPages = options.maxPages ?? null;
  const skipExisting = Boolean(options.skipExisting);
  const allowPartial = Boolean(options.allowPartial);
  const requestAttempts = Math.max(1, options.requestAttempts ?? 3);
  const retryDelaySeconds = Math.max(0, options.retryDelaySeconds ?? 1.5);
  const pageRecords = [];
  const skippedRecords = [];
  const failedPages = [];
  const chapterCount = (downloadPlan.chapters ?? []).length;
  let coverPath = null;
  fs.mkdirSync(imagesRoot, { recursive: true });

  if (downloadPlan.cover_url) {
    const coverTarget = path.join(imagesRoot, `cover${extensionFromUrl(downloadPlan.cover_url, ".jpg")}`);
    if (skipExisting && fs.existsSync(coverTarget) && fs.statSync(coverTarget).size > 0) {
      coverPath = coverTarget;
      skippedRecords.push(coverTarget);
    } else {
      const data = await downloadBytes(downloadPlan.cover_url, { attempts: requestAttempts, retryDelaySeconds });
      fs.writeFileSync(coverTarget, data);
      coverPath = coverTarget;
    }
  }

  let processedPages = 0;
  for (const chapter of downloadPlan.chapters ?? []) {
    const targetDir = chapterDir(imagesRoot, chapter, chapterCount);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const page of chapter.pages ?? []) {
      if (maxPages !== null && processedPages >= maxPages) {
        return snapshot({ status: failedPages.length ? "partial_success" : "completed", imagesRoot, pageRecords, skippedRecords, failedPages, coverPath, maxPages, requestAttempts });
      }
      const index = Number.parseInt(page.index ?? 0, 10);
      const originalName = String(page.name ?? `${index}`);
      const outputPath = page.requires_descramble
        ? path.join(targetDir, `${String(index).padStart(4, "0")}.png`)
        : path.join(targetDir, `${String(index).padStart(4, "0")}${path.extname(originalName).toLowerCase() || extensionFromUrl(page.url)}`);

      if (skipExisting && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        skippedRecords.push(outputPath);
        processedPages += 1;
        continue;
      }

      try {
        const raw = await downloadBytes(page.url, { attempts: requestAttempts, retryDelaySeconds });
        const payload = page.requires_descramble
          ? await descrambleToPng(raw, Number.parseInt(page.chapter_id, 10), originalName, Number.parseInt(page.scramble_id ?? 0, 10))
          : raw;
        fs.writeFileSync(outputPath, payload);
        pageRecords.push(outputPath);
        processedPages += 1;
      } catch (error) {
        const failedPage = {
          index,
          url: page.url,
          chapter_id: String(page.chapter_id ?? ""),
          requires_descramble: Boolean(page.requires_descramble),
          error_code: error.code ?? "NETWORK_ERROR",
          message: error instanceof Error ? error.message : String(error),
        };
        if (allowPartial) {
          failedPages.push(failedPage);
          processedPages += 1;
          continue;
        }
        throw new DownloadExecutionError(
          failedPage.error_code,
          `Failed to download JM page ${index}: ${page.url}`,
          "Retry with --skip-existing to resume from already downloaded pages.",
          { ...snapshot({ status: "failed", imagesRoot, pageRecords, skippedRecords, failedPages, coverPath, maxPages, requestAttempts }), failed_page: failedPage },
        );
      }
    }
  }

  if (failedPages.length && !pageRecords.length && !skippedRecords.length) {
    throw new DownloadExecutionError("NETWORK_ERROR", "JM download could not fetch any pages successfully.", "Retry with a different target or a smaller --page-limit.", snapshot({ status: "failed", imagesRoot, pageRecords, skippedRecords, failedPages, coverPath, maxPages, requestAttempts }));
  }
  return snapshot({ status: failedPages.length ? "partial_success" : "completed", imagesRoot, pageRecords, skippedRecords, failedPages, coverPath, maxPages, requestAttempts });
}
