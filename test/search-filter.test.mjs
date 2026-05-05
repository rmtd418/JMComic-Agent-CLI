import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidateFilters } from "../src/jm/provider.js";

const candidate = {
  title: "Michelle to Icha Love",
  authors: ["Mucc"],
  tags: ["巨乳", "中出", "中文"],
  language: "zh",
  page_count: 48,
  chapter_count: 1,
  popularity: { likes: 100, total_views: 200 },
};

test("evaluateCandidateFilters accepts matching structured filters", () => {
  const result = evaluateCandidateFilters(candidate, {
    language: "中文",
    title_contains: "Love",
    author_contains: "Mucc",
    min_pages: 10,
    max_pages: 60,
    min_chapters: 1,
    min_likes: 50,
  }, ["中出"]);
  assert.equal(result.matched, true);
  assert.equal(result.score > 0, true);
});

test("evaluateCandidateFilters rejects missing tag and page range", () => {
  assert.equal(evaluateCandidateFilters(candidate, {}, ["不存在"]).matched, false);
  assert.equal(evaluateCandidateFilters(candidate, { min_pages: 100 }, []).matched, false);
});
