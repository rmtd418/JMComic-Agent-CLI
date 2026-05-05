import { asArray, asInt } from "../shared/args.js";

function optionalString(value) {
  return value && value !== true ? String(value) : null;
}

function optionalInt(value) {
  if (value === undefined || value === null || value === true) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildQueryRequest(values) {
  const limit = asInt(values.limit, 10);
  return {
    scope: {
      query: optionalString(values.query),
      tags: asArray(values.tag).filter((tag) => tag !== true).map(String),
    },
    filters: {
      language: optionalString(values.language),
      sort: optionalString(values.sort) ?? "relevance",
      limit,
      output_mode: optionalString(values.output) ?? "report",
      chat_limit: optionalInt(values["chat-limit"]),
      report_limit: optionalInt(values["report-limit"]),
      profile: optionalString(values.profile) ?? "balanced",
      title_contains: optionalString(values.title),
      author_contains: optionalString(values.author),
      with_page_count: Boolean(values["with-page-count"]),
      with_chapter_count: Boolean(values["with-chapter-count"]),
      min_pages: optionalInt(values["min-pages"]),
      max_pages: optionalInt(values["max-pages"]),
      min_chapters: optionalInt(values["min-chapters"]),
      min_likes: optionalInt(values["min-likes"]),
    },
    selection: {
      pick: optionalString(values.pick) ?? "best",
      shortlist_limit: limit,
    },
  };
}

export function buildDownloadInput(values) {
  return {
    item_id: optionalString(values.id),
    query: optionalString(values.query),
    tags: asArray(values.tag).filter((tag) => tag !== true).map(String),
    language: optionalString(values.language),
    sort: optionalString(values.sort) ?? "relevance",
    title_contains: optionalString(values.title),
    author_contains: optionalString(values.author),
    profile: optionalString(values.profile) ?? "balanced",
    with_page_count: Boolean(values["with-page-count"]),
    with_chapter_count: Boolean(values["with-chapter-count"]),
    pick: optionalString(values.pick) ?? "best",
    limit: asInt(values.limit, 10),
    min_pages: optionalInt(values["min-pages"]),
    max_pages: optionalInt(values["max-pages"]),
    min_chapters: optionalInt(values["min-chapters"]),
    min_likes: optionalInt(values["min-likes"]),
    execution_page_limit: optionalInt(values["page-limit"]),
    skip_existing: Boolean(values["skip-existing"]),
    allow_partial: Boolean(values["allow-partial"]),
    resume_manifest: optionalString(values["resume-manifest"]),
    failed_pages_only: Boolean(values["failed-pages-only"]),
    images_dir: optionalString(values["images-dir"]),
    request_attempts: optionalInt(values["request-attempts"]),
    retry_delay_seconds: values["retry-delay"] === undefined || values["retry-delay"] === true ? null : Number.parseFloat(String(values["retry-delay"])),
  };
}
