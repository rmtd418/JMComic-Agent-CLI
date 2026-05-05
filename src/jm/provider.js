import { jmRequest } from "./bridge.js";
import { loadFavoritesCache, saveFavoritesCache } from "../favorites-cache.js";
import { favoritesCachePath } from "../shared/paths.js";

export const JM_BASE_URLS = [
  "https://www.cdnsha.org",
  "https://www.cdnbea.cc",
  "https://www.cdnbea.net",
  "https://www.cdn-mspjmapiproxy.xyz",
];

export const JM_IMAGE_BASE_URLS = [
  "https://cdn-msp12.jmdanjonproxy.xyz",
  "https://cdn-msp.jmapiproxy1.cc",
  "https://cdn-msp2.jmdanjonproxy.vip",
  "https://cdn-msp.jmdanjonproxy.vip",
];

export const JM_SCRAMBLE_ID = 220980;

export class JmProviderError extends Error {
  constructor(code, message, nextAction = null) {
    super(message);
    this.name = "JmProviderError";
    this.code = code;
    this.next_action = nextAction;
  }
}

function sortParam(sort) {
  return {
    relevance: "",
    popular: "mv",
    recent: "",
    random: "",
  }[sort] ?? "";
}

function buildQuery(query, tags) {
  const parts = [];
  if (query && String(query).trim()) {
    parts.push(String(query).trim());
  }
  for (const tag of tags ?? []) {
    if (String(tag).trim()) {
      parts.push(String(tag).trim());
    }
  }
  if (!parts.length) {
    throw new JmProviderError("INPUT_REQUIRED", "JM command requires --query, at least one --tag, or --id.", "Provide a target id or search input.");
  }
  return parts.join(" ");
}

function bridgeError(message) {
  const text = String(message || "").trim();
  if (text.includes("登录过期") || text.includes("請先登入會員") || text.includes("请先登入会员")) {
    return new JmProviderError("AUTH_REQUIRED", text, "Login support will be added in a later migration step.");
  }
  if (text.includes("password") || text.includes("账号") || text.includes("帳號") || text.includes("无效的用户名") || text.includes("無效的使用者")) {
    return new JmProviderError("AUTH_INVALID", text, "Check credentials when auth migration is enabled.");
  }
  return new JmProviderError("NETWORK_ERROR", text || "JM request failed.", "Retry the command or try another keyword.");
}

async function request(requestPath, params = {}, options = {}) {
  let lastError = null;
  for (const baseUrl of JM_BASE_URLS) {
    try {
      return await jmRequest({
        method: options.method ?? "GET",
        baseUrl,
        requestPath,
        params,
        data: options.data ?? null,
        formData: options.formData ?? null,
        cache: Boolean(options.cache),
        useJwt: Boolean(options.useJwt),
        jwtToken: options.jwtToken ?? "",
      });
    } catch (error) {
      lastError = error;
      const mapped = bridgeError(error instanceof Error ? error.message : String(error));
      if (mapped.code === "AUTH_INVALID" || mapped.code === "AUTH_REQUIRED") {
        throw mapped;
      }
    }
  }
  throw bridgeError(lastError instanceof Error ? lastError.message : String(lastError));
}

export async function login(username, password) {
  try {
    const payload = await request("/login", {}, {
      method: "POST",
      formData: { username, password },
    });
    const jwtToken = String(payload?.jwttoken ?? "").trim();
    if (!jwtToken) {
      throw new JmProviderError("AUTH_INVALID", "JM login did not return a reusable session token.", "Check the account and retry.");
    }
    return {
      provider: "jm",
      session_kind: "jwt",
      jwt_token: jwtToken,
      username,
      login_state: "authenticated",
      saved_at: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof JmProviderError) throw error;
    throw bridgeError(error instanceof Error ? error.message : String(error));
  }
}

export async function validateSession(jwtToken) {
  const payload = await request("/favorite", { page: 1, folder_id: "0", o: "mr" }, { useJwt: true, jwtToken });
  const items = parseContent(payload?.content ?? payload?.list ?? payload?.items ?? []);
  return {
    provider: "jm",
    session_kind: "jwt",
    status: "active",
    favorite_sample_count: items.length,
  };
}

function parseContent(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toInt(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function categoryTitle(value) {
  return value && typeof value === "object" && value.title ? String(value.title) : null;
}

function languageAliases() {
  return {
    zh: ["中文", "汉化", "漢化", "chinese", "cn"],
    en: ["英文", "english", "en"],
    jp: ["日文", "日语", "日語", "日本語", "japanese", "jp", "ja"],
    ko: ["韩文", "韓文", "korean", "ko"],
  };
}

function normalizeRequestedLanguage(value) {
  if (!value) {
    return null;
  }
  const lowered = String(value).trim().toLowerCase();
  const aliases = languageAliases();
  if (aliases[lowered]) {
    return lowered;
  }
  for (const [language, names] of Object.entries(aliases)) {
    if (names.some((name) => name.toLowerCase() === lowered)) {
      return language;
    }
  }
  return lowered;
}

function detectLanguage(title, tags, authors) {
  const haystack = [title, ...tags, ...authors].join(" ").toLowerCase();
  for (const [language, names] of Object.entries(languageAliases())) {
    if (names.some((name) => haystack.includes(name.toLowerCase()))) {
      return language;
    }
  }
  return null;
}

function extractChapterRefs(album) {
  const series = Array.isArray(album.series) ? album.series : [];
  if (series.length) {
    return series.map((item) => ({
      id: String(item.id ?? album.id),
      name: String(item.name ?? album.name ?? ""),
      sort: String(item.sort ?? ""),
    }));
  }
  return [{ id: String(album.id), name: String(album.name ?? ""), sort: "1" }];
}

function normalizeCandidate(searchItem, album, { includeChapterCount = false, includePageCount = false, pageCount = null } = {}) {
  const id = String(album.id ?? searchItem.id ?? "");
  const authors = Array.isArray(album.author) ? album.author.map(String) : [];
  const tags = Array.isArray(album.tags) ? album.tags.map(String).filter(Boolean) : [];
  const works = Array.isArray(album.works) ? album.works.map(String).filter(Boolean) : [];
  const actors = Array.isArray(album.actors) ? album.actors.map(String).filter(Boolean) : [];
  const chapters = extractChapterRefs(album);
  const title = String(album.name ?? searchItem.name ?? "");
  return {
    id,
    provider: "jm",
    title,
    authors,
    tags,
    language: detectLanguage(title, [...tags, ...works, ...actors], authors),
    works,
    actors,
    page_count: includePageCount ? pageCount : null,
    chapter_count: includeChapterCount ? chapters.length : null,
    category: categoryTitle(searchItem.category),
    category_sub: categoryTitle(searchItem.category_sub),
    update_time: searchItem.update_at ?? null,
    cover_url: `${JM_IMAGE_BASE_URLS[0]}/media/albums/${id}_3x4.jpg`,
    popularity: {
      likes: toInt(album.likes),
      total_views: toInt(album.total_views),
    },
    download_ready: true,
    _chapter_refs: chapters,
    _search_item: searchItem,
    _album: album,
  };
}

function candidateForAgent(candidate, { includeOptional = true, includePopularity = false, includeMetrics = false } = {}) {
  const payload = {
    id: candidate.id,
    title: candidate.title,
    authors: candidate.authors,
    tags: candidate.tags,
    language: candidate.language,
  };
  if (includeMetrics) {
    payload.page_count = candidate.page_count;
    payload.chapter_count = candidate.chapter_count;
  }
  if (includeOptional) {
    payload.works = candidate.works;
    payload.actors = candidate.actors;
    payload.category = candidate.category;
    payload.update_time = candidate.update_time;
  }
  if (includePopularity) {
    payload.popularity = candidate.popularity;
  }
  return payload;
}

function containsText(haystack, needle) {
  if (!needle) {
    return true;
  }
  return String(haystack ?? "").toLowerCase().includes(String(needle).trim().toLowerCase());
}

export function evaluateCandidateFilters(candidate, filters, requestedTags) {
  const language = normalizeRequestedLanguage(filters.language);
  const languageOk = !language || candidate.language === language || candidate.language === null;
  const titleOk = containsText(candidate.title, filters.title_contains);
  const authorNeedle = String(filters.author_contains ?? "").trim();
  const matchedAuthors = authorNeedle ? candidate.authors.filter((author) => containsText(author, authorNeedle)) : [];
  const authorOk = !authorNeedle || matchedAuthors.length > 0;
  const likes = candidate.popularity?.likes ?? 0;
  const pageCount = candidate.page_count ?? 0;
  const chapterCount = candidate.chapter_count ?? 0;
  const minPagesOk = filters.min_pages == null || pageCount >= filters.min_pages;
  const maxPagesOk = filters.max_pages == null || pageCount <= filters.max_pages;
  const minChaptersOk = filters.min_chapters == null || chapterCount >= filters.min_chapters;
  const minLikesOk = filters.min_likes == null || likes >= filters.min_likes;
  const tags = candidate.tags.map((tag) => tag.toLowerCase());
  const title = candidate.title.toLowerCase();
  const matchedTags = [];

  for (const tag of requestedTags) {
    const requested = String(tag).trim().toLowerCase();
    if (!requested) {
      continue;
    }
    if (title.includes(requested) || tags.some((existing) => existing.includes(requested))) {
      matchedTags.push(tag);
    } else {
      return { matched: false, score: 0 };
    }
  }

  const matched = languageOk && titleOk && authorOk && minPagesOk && maxPagesOk && minChaptersOk && minLikesOk;
  let score = matchedTags.length;
  if (filters.title_contains && titleOk) score += 3;
  if (authorNeedle && authorOk) score += 2;
  if (language && candidate.language === language) score += 1;
  return { matched, score };
}

function selectionKey(candidate, pick) {
  const likes = candidate.popularity?.likes ?? 0;
  const views = candidate.popularity?.total_views ?? 0;
  const updateTime = toInt(candidate.update_time) ?? 0;
  const score = candidate._match_score ?? 0;
  const rank = -(candidate._provider_rank ?? 10 ** 9);
  if (pick === "top") return [likes, views, score, rank, updateTime];
  if (pick === "recent") return [updateTime, score, likes, views, rank];
  return [score, likes, views, rank, updateTime];
}

function compareSelection(a, b, pick) {
  const left = selectionKey(a, pick);
  const right = selectionKey(b, pick);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return right[index] - left[index];
    }
  }
  return 0;
}

function profileSearchPages(profile) {
  return { fast: 1, balanced: 3, deep: 5 }[profile] ?? 3;
}

function profileSearchWindow(profile) {
  return { fast: 80, balanced: 240, deep: 400 }[profile] ?? 240;
}

function profileDetailWorkers(profile) {
  return { fast: 6, balanced: 12, deep: 20 }[profile] ?? 12;
}

function profileDetailBudget(profile, requestedLimit, reportLimit, needsDeepDetail) {
  if (!needsDeepDetail) return Math.max(requestedLimit, reportLimit);
  return {
    fast: Math.max(10, requestedLimit),
    balanced: Math.max(20, requestedLimit),
    deep: Math.max(40, requestedLimit),
  }[profile] ?? Math.max(20, requestedLimit);
}

async function fetchSearchItems(query, { sort, limit, profile = "balanced" }) {
  const maxPages = profileSearchPages(profile);
  const searchWindow = Math.max(limit, profileSearchWindow(profile));
  const pages = Array.from({ length: maxPages }, (_, index) => index + 1);
  const responses = await Promise.all(pages.map(async (page) => {
    const payload = await request("/search", { search_query: query, page, o: sortParam(sort) });
    if (!payload || typeof payload !== "object") {
      throw new JmProviderError("PARSE_ERROR", "JM search returned an unexpected payload.", "Retry the query.");
    }
    return { page, payload };
  }));
  responses.sort((a, b) => a.page - b.page);
  const seen = new Set();
  const deduped = [];
  let total = 0;
  let pagesFetched = 0;
  for (const response of responses) {
    pagesFetched = response.page;
    total = toInt(response.payload.total) ?? total;
    const items = parseContent(response.payload.content);
    if (!items.length) break;
    for (const item of items) {
      const id = String(item?.id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push(item);
      if (deduped.length >= searchWindow) break;
    }
    if (deduped.length >= searchWindow || items.length < 80) break;
  }
  return { items: deduped.slice(0, searchWindow), total: total || deduped.length, pagesFetched, searchWindow };
}

export async function fetchAlbum(id) {
  const album = await request("/album", { id: String(id) });
  if (!album || typeof album !== "object" || !album.id) {
    throw new JmProviderError("NOT_FOUND", `JM could not load album metadata for id ${id}.`, "Try another target.");
  }
  return album;
}

export async function fetchChapter(id) {
  const chapter = await request("/chapter", { skip: "", id: String(id) }, { cache: true });
  if (!chapter || typeof chapter !== "object") {
    throw new JmProviderError("NOT_FOUND", `JM could not load chapter metadata for id ${id}.`, "Try another target.");
  }
  return chapter;
}

export async function computePageCount(chapterRefs) {
  let total = 0;
  for (const ref of chapterRefs) {
    const chapter = await fetchChapter(ref.id);
    total += Array.isArray(chapter.images) ? chapter.images.length : 0;
  }
  return total;
}

function outputSettings(filters, requestedLimit, pick) {
  const outputMode = String(filters.output_mode ?? "report");
  const chatLimit = Math.max(1, Math.min(Number.parseInt(filters.chat_limit ?? 5, 10) || 5, 20));
  const reportLimit = Math.max(requestedLimit, Math.min(Number.parseInt(filters.report_limit ?? 10, 10) || 10, 20));
  const includeMetrics = Boolean(filters.with_page_count || filters.with_chapter_count || filters.min_pages != null || filters.max_pages != null || filters.min_chapters != null);
  if (outputMode === "full") {
    return { outputMode, aiLimit: requestedLimit, reportLimit, includeOptional: true, includePopularity: true, includeMetrics };
  }
  if (outputMode === "brief") {
    return { outputMode, aiLimit: Math.min(requestedLimit, chatLimit), reportLimit, includeOptional: false, includePopularity: false, includeMetrics };
  }
  return {
    outputMode,
    aiLimit: Math.min(requestedLimit, chatLimit),
    reportLimit,
    includeOptional: Math.min(requestedLimit, chatLimit) <= 5,
    includePopularity: pick === "top" && Math.min(requestedLimit, chatLimit) <= 5,
    includeMetrics,
  };
}

export async function discoverCandidates(requestPayload) {
  const scope = requestPayload.scope;
  const filters = requestPayload.filters;
  const selection = requestPayload.selection;
  const query = buildQuery(scope.query, scope.tags ?? []);
  const requestedLimit = Math.max(1, Math.min(Number.parseInt(filters.limit ?? 10, 10) || 10, 20));
  const settings = outputSettings(filters, requestedLimit, selection.pick ?? "best");
  const needsPages = Boolean(filters.with_page_count || filters.min_pages != null || filters.max_pages != null);
  const needsChapters = Boolean(filters.with_chapter_count || filters.min_chapters != null);
  const needsDeepDetail = Boolean((scope.tags ?? []).length || filters.language || filters.min_likes != null || needsPages || needsChapters || selection.pick === "top");
  const searchLimit = Math.max(requestedLimit, settings.reportLimit);
  const profile = String(filters.profile ?? "balanced");
  const search = await fetchSearchItems(query, { sort: filters.sort ?? "relevance", limit: searchLimit, profile });
  const detailBudget = profileDetailBudget(profile, requestedLimit, settings.reportLimit, needsDeepDetail);
  const detailItems = search.items.slice(0, detailBudget);
  const warnings = [];
  const candidates = [];
  let detailFailures = 0;
  let filteredOut = 0;

  const detailWorkers = profileDetailWorkers(profile);
  let cursor = 0;
  async function nextDetail() {
    while (cursor < detailItems.length) {
      const index = cursor;
      const searchItem = detailItems[cursor];
      cursor += 1;
      try {
        const album = await fetchAlbum(searchItem.id);
        const refs = extractChapterRefs(album);
        const pageCount = needsPages ? await computePageCount(refs) : null;
        const candidate = normalizeCandidate(searchItem, album, {
          includeChapterCount: needsChapters,
          includePageCount: needsPages,
          pageCount,
        });
        candidate._provider_rank = index + 1;
        const evaluated = evaluateCandidateFilters(candidate, filters, scope.tags ?? []);
        candidate._match_score = evaluated.score;
        if (evaluated.matched) {
          candidates.push(candidate);
        } else {
          filteredOut += 1;
        }
      } catch (error) {
        detailFailures += 1;
        warnings.push(`JM detail fetch failed for ${searchItem.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(detailWorkers, detailItems.length || 1) }, () => nextDetail()));

  /*
  for (const [index, searchItem] of search.items.entries()) {
    try {
      const album = await fetchAlbum(searchItem.id);
      const refs = extractChapterRefs(album);
      const pageCount = needsPages ? await computePageCount(refs) : null;
      const candidate = normalizeCandidate(searchItem, album, {
        includeChapterCount: needsChapters,
        includePageCount: needsPages,
        pageCount,
      });
      candidate._provider_rank = index + 1;
      const evaluated = evaluateCandidateFilters(candidate, filters, scope.tags ?? []);
      candidate._match_score = evaluated.score;
      if (evaluated.matched) {
        candidates.push(candidate);
      } else {
        filteredOut += 1;
      }
    } catch (error) {
      detailFailures += 1;
      warnings.push(`JM detail fetch failed for ${searchItem.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  */

  const ordered = selection.pick === "random" ? candidates.sort(() => Math.random() - 0.5) : candidates.sort((a, b) => compareSelection(a, b, selection.pick ?? "best"));
  if (search.items.length > 0 && ordered.length === 0) {
    warnings.push("JM returned search results, but none matched the requested filters.");
  }
  return {
    candidates: ordered.slice(0, requestedLimit),
    meta: {
      query,
      search_total: search.total,
      pages_fetched: search.pagesFetched,
      raw_result_count: search.items.length,
      detail_fetch_count: detailItems.length,
      detail_failure_count: detailFailures,
      filtered_count: ordered.length,
      filtered_out_count: filteredOut,
      returned_count: Math.min(ordered.length, settings.aiLimit),
      more_results_available: search.total > ordered.length,
      output_mode: settings.outputMode,
      settings,
      profile,
      search_window: search.searchWindow,
      detail_workers: detailWorkers,
      detail_budget: detailBudget,
    },
    warnings,
  };
}

export async function discover(requestPayload) {
  const { candidates, meta, warnings } = await discoverCandidates(requestPayload);
  return {
    result: {
      phase: "provider",
      status: "ready",
      provider: "jm",
      query: meta.query,
      search_total: meta.search_total,
      pages_fetched: meta.pages_fetched,
      raw_result_count: meta.raw_result_count,
      detail_fetch_count: meta.detail_fetch_count,
      detail_failure_count: meta.detail_failure_count,
      filtered_count: meta.filtered_count,
      filtered_out_count: meta.filtered_out_count,
      returned_count: meta.returned_count,
      more_results_available: meta.more_results_available,
      output_mode: meta.output_mode,
      shortlist: candidates.slice(0, meta.settings.aiLimit).map((item) => candidateForAgent(item, meta.settings)),
      selection_policy: requestPayload.selection,
      applied_filters: requestPayload.filters,
    },
    warnings,
  };
}

export async function resolve(requestPayload) {
  const { candidates, meta, warnings } = await discoverCandidates(requestPayload);
  const selected = candidates[0] ?? null;
  return {
    result: {
      phase: "provider",
      status: selected ? "ready" : "not_found",
      provider: "jm",
      query: meta.query,
      selected: selected ? candidateForAgent(selected, { includeOptional: true, includePopularity: true, includeMetrics: meta.settings.includeMetrics }) : null,
      shortlist: candidates.slice(0, Math.min(5, candidates.length)).map((item) => candidateForAgent(item, meta.settings)),
      selection_policy: requestPayload.selection,
      applied_filters: requestPayload.filters,
      search_total: meta.search_total,
      filtered_count: meta.filtered_count,
      more_results_available: meta.more_results_available,
    },
    warnings,
    selected,
  };
}

export async function buildDownloadPlanFromAlbum(album) {
  const chapterRefs = extractChapterRefs(album);
  const chapters = [];
  let totalPages = 0;
  for (const ref of chapterRefs) {
    const chapter = await fetchChapter(ref.id);
    const images = Array.isArray(chapter.images) ? chapter.images : [];
    const pages = images.map((imageName, index) => ({
      index: index + 1,
      name: String(imageName),
      url: `${JM_IMAGE_BASE_URLS[0]}/media/photos/${ref.id}/${imageName}`,
      requires_descramble: Number.parseInt(ref.id, 10) >= JM_SCRAMBLE_ID,
      scramble_id: JM_SCRAMBLE_ID,
      album_id: String(album.id),
      chapter_id: String(ref.id),
    }));
    totalPages += pages.length;
    chapters.push({
      id: String(ref.id),
      title: String(chapter.name ?? ref.name),
      sort: ref.sort,
      page_count: pages.length,
      requires_descramble: Number.parseInt(ref.id, 10) >= JM_SCRAMBLE_ID,
      pages,
    });
  }
  return {
    item_id: String(album.id),
    title: String(album.name ?? ""),
    cover_url: `${JM_IMAGE_BASE_URLS[0]}/media/albums/${album.id}_3x4.jpg`,
    image_base_url: JM_IMAGE_BASE_URLS[0],
    chapter_count: chapters.length,
    page_count: totalPages,
    chapters,
  };
}

export async function downloadPlan(input) {
  let album;
  let selected = null;
  const warnings = [];
  if (input.item_id) {
    album = await fetchAlbum(String(input.item_id));
    selected = normalizeCandidate({ id: album.id, name: album.name }, album, { includeChapterCount: true });
  } else {
    const requestPayload = {
      scope: { query: input.query ?? null, tags: input.tags ?? [] },
      filters: {
        language: input.language,
        sort: input.sort ?? "relevance",
        limit: input.limit ?? 10,
        output_mode: "report",
        title_contains: input.title_contains,
        author_contains: input.author_contains,
        with_page_count: input.with_page_count ?? false,
        with_chapter_count: input.with_chapter_count ?? false,
        min_pages: input.min_pages,
        max_pages: input.max_pages,
        min_chapters: input.min_chapters,
        min_likes: input.min_likes,
      },
      selection: { pick: input.pick ?? "best", shortlist_limit: input.limit ?? 10 },
    };
    const resolved = await resolve(requestPayload);
    warnings.push(...resolved.warnings);
    if (!resolved.selected) {
      throw new JmProviderError("NOT_FOUND", "JM could not resolve the requested target.", "Try a different query or specify --id.");
    }
    selected = resolved.selected;
    album = selected._album ?? await fetchAlbum(selected.id);
  }
  const plan = await buildDownloadPlanFromAlbum(album);
  return {
    result: {
      phase: "provider",
      status: "planned",
      provider: "jm",
      selected: selected ? candidateForAgent(selected, { includeOptional: true, includePopularity: false }) : null,
      download_ready: true,
      chapter_count: plan.chapter_count,
      page_count: plan.page_count,
      cover_url: plan.cover_url,
    },
    summary: {
      mode: input.item_id ? "by_id" : "by_query",
      selected_count: 1,
      download_ready: true,
      selected_item: selected ? candidateForAgent(selected, { includeOptional: true, includePopularity: false }) : null,
      download_plan: plan,
    },
    warnings,
  };
}

function favoriteItemId(item) {
  return String(item?.id ?? item?.aid ?? item?.album_id ?? "").trim();
}

function favoriteSearchItem(item) {
  return {
    id: favoriteItemId(item),
    name: item?.name ?? item?.title,
    author: item?.author,
    update_at: item?.update_at ?? item?.addtime,
    category: item?.category ?? {},
    category_sub: item?.category_sub ?? {},
  };
}

function snapshotFavoriteCandidate(item, cacheEntry = null) {
  const id = favoriteItemId(item);
  const title = String(cacheEntry?.title ?? item?.name ?? item?.title ?? id);
  const authors = cacheEntry?.authors ?? (item?.author ? [String(item.author)] : []);
  const tags = cacheEntry?.tags ?? [];
  const works = cacheEntry?.works ?? [];
  const actors = cacheEntry?.actors ?? [];
  return {
    id,
    provider: "jm",
    title,
    authors,
    tags,
    works,
    actors,
    language: cacheEntry?.language ?? detectLanguage(title, [...tags, ...works, ...actors], authors),
    page_count: cacheEntry?.page_count ?? null,
    chapter_count: cacheEntry?.chapter_count ?? null,
    popularity: {
      likes: cacheEntry?.likes ?? null,
      total_views: cacheEntry?.total_views ?? null,
    },
    category: cacheEntry?.category ?? categoryTitle(item?.category),
    category_sub: cacheEntry?.category_sub ?? categoryTitle(item?.category_sub),
    update_time: cacheEntry?.update_time ?? item?.update_at ?? item?.addtime ?? null,
    cover_url: cacheEntry?.cover_url ?? item?.image ?? null,
    download_ready: Boolean(id),
  };
}

async function fetchAllFavorites(jwtToken, folderId, maxItems = 20) {
  const allItems = [];
  let page = 1;
  let total = 0;
  let folderList = [];
  while (true) {
    const payload = await request("/favorite", { page, folder_id: folderId, o: "mr" }, { useJwt: true, jwtToken });
    if (page === 1) folderList = Array.isArray(payload?.folder_list) ? payload.folder_list : [];
    const items = parseContent(payload?.content ?? payload?.list ?? payload?.items ?? []);
    total = (toInt(payload?.total) ?? total) || items.length;
    if (!items.length) break;
    for (const item of items) {
      item._favorite_rank = allItems.length + 1;
      allItems.push(item);
    }
    if ((total && allItems.length >= total) || allItems.length >= maxItems) break;
    page += 1;
  }
  return { items: allItems, meta: { remote_total: total || allItems.length, pages_fetched: page, folder_count: folderList.length } };
}

export async function favorites(requestPayload, jwtToken) {
  const library = requestPayload.library;
  const folderId = String(library.folder_id ?? "0");
  const requestedLimit = Math.max(1, Math.min(Number.parseInt(library.limit ?? 10, 10) || 10, 20));
  const filters = {
    language: library.language,
    sort: library.sort ?? "relevance",
    limit: requestedLimit,
    output_mode: library.output_mode ?? "report",
    chat_limit: library.chat_limit,
    report_limit: library.report_limit,
    profile: library.profile ?? "balanced",
    title_contains: library.title_contains ?? library.query,
    author_contains: library.author_contains,
    with_page_count: library.with_page_count ?? false,
    with_chapter_count: library.with_chapter_count ?? false,
    min_pages: library.min_pages,
    max_pages: library.max_pages,
    min_chapters: library.min_chapters,
    min_likes: library.min_likes,
  };
  const settings = outputSettings(filters, requestedLimit, library.pick ?? "best");
  const page = Math.max(1, Number.parseInt(library.page ?? 1, 10) || 1);
  const remote = await fetchAllFavorites(jwtToken, folderId, Math.max(page * requestedLimit, requestedLimit));
  const cache = loadFavoritesCache("jm");
  const requestedTags = library.tags ?? [];
  const needsAlbum = Boolean(requestedTags.length || filters.language || filters.min_likes != null || filters.with_chapter_count || filters.min_chapters != null || library.pick === "top" || filters.title_contains || filters.author_contains);
  const needsPages = Boolean(filters.with_page_count || filters.min_pages != null || filters.max_pages != null);
  let detailFetchCount = 0;
  let detailFailures = 0;
  const candidates = [];
  let filteredOut = 0;

  cache.provider = "jm";
  cache.folders[folderId] = { synced_at: new Date().toISOString(), remote_count: remote.items.length };

  for (const item of remote.items) {
    const id = favoriteItemId(item);
    if (!id) continue;
    let cacheEntry = cache.items[id] ?? null;
    if (needsAlbum || needsPages) {
      try {
        const album = await fetchAlbum(id);
        const refs = extractChapterRefs(album);
        const pageCount = needsPages ? await computePageCount(refs) : cacheEntry?.page_count ?? null;
        const candidate = normalizeCandidate(favoriteSearchItem(item), album, {
          includeChapterCount: needsAlbum || needsPages || filters.with_chapter_count,
          includePageCount: needsPages,
          pageCount,
        });
        cacheEntry = {
          title: candidate.title,
          authors: candidate.authors,
          tags: candidate.tags,
          works: candidate.works,
          actors: candidate.actors,
          language: candidate.language,
          page_count: candidate.page_count,
          chapter_count: candidate.chapter_count,
          likes: candidate.popularity.likes,
          total_views: candidate.popularity.total_views,
          category: candidate.category,
          category_sub: candidate.category_sub,
          update_time: candidate.update_time,
          cover_url: candidate.cover_url,
          detail_fetched_at: new Date().toISOString(),
        };
        cache.items[id] = cacheEntry;
        detailFetchCount += 1;
      } catch {
        detailFailures += 1;
      }
    }
    const candidate = snapshotFavoriteCandidate(item, cacheEntry);
    candidate._favorite_rank = item._favorite_rank ?? 0;
    const evaluated = evaluateCandidateFilters(candidate, filters, requestedTags);
    candidate._match_score = evaluated.score;
    if (evaluated.matched) candidates.push(candidate);
    else filteredOut += 1;
  }

  cache.sync_runs.push({ at: new Date().toISOString(), folder_id: folderId, remote_count: remote.items.length, detail_fetch_count: detailFetchCount, detail_failure_count: detailFailures });
  saveFavoritesCache(cache, "jm");
  const ordered = library.pick === "random"
    ? candidates.sort(() => Math.random() - 0.5)
    : candidates.sort((a, b) => {
        if (library.pick === "recent") return (a._favorite_rank ?? 0) - (b._favorite_rank ?? 0);
        return compareSelection(a, b, library.pick ?? "best");
      });
  const paged = ordered.slice((page - 1) * requestedLimit, page * requestedLimit);
  return {
    result: {
      phase: "provider",
      status: "ready",
      provider: "jm",
      source: "favorites",
      output_mode: settings.outputMode,
      page,
      folder_id: folderId,
      raw_result_count: remote.items.length,
      filtered_count: candidates.length,
      filtered_out_count: filteredOut,
      returned_count: Math.min(paged.length, settings.aiLimit),
      more_results_available: ordered.length > page * requestedLimit,
      shortlist: paged.slice(0, settings.aiLimit).map((candidate) => candidateForAgent(candidate, settings)),
      selection_policy: { pick: library.pick ?? "best", shortlist_limit: requestedLimit },
      applied_filters: filters,
      cache: {
        path: favoritesCachePath("jm"),
        detail_fetch_count: detailFetchCount,
        detail_failure_count: detailFailures,
      },
      sync: remote.meta,
    },
    warnings: detailFailures ? [`JM favorites had ${detailFailures} detail refresh failures.`] : [],
  };
}
