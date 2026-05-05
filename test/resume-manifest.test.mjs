import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { filterPlanToFailedPages, loadResumeManifest } from "../src/commands/download.js";

test("loadResumeManifest rejects manifests without a download plan", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jm-agent-resume-"));
  const target = path.join(root, "manifest.json");
  fs.writeFileSync(target, JSON.stringify({ summary: {} }), "utf8");

  assert.throws(() => loadResumeManifest(target), /summary\.download_plan/);
});

test("filterPlanToFailedPages keeps only failed page entries", () => {
  const plan = {
    chapters: [
      {
        id: "c1",
        pages: [
          { chapter_id: "c1", index: 1 },
          { chapter_id: "c1", index: 2 },
        ],
      },
      {
        id: "c2",
        pages: [
          { chapter_id: "c2", index: 1 },
          { chapter_id: "c2", index: 2 },
        ],
      },
    ],
  };

  const filtered = filterPlanToFailedPages(plan, [
    { chapter_id: "c1", index: 2 },
    { chapter_id: "c2", index: 1 },
  ]);

  assert.deepEqual(filtered.chapters.map((chapter) => chapter.pages.map((page) => `${page.chapter_id}:${page.index}`)), [
    ["c1:2"],
    ["c2:1"],
  ]);
});
