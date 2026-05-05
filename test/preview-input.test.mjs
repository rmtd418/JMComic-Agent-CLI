import test from "node:test";
import assert from "node:assert/strict";
import { expandPreviewIds } from "../src/commands/preview.js";

test("expandPreviewIds accepts repeated and comma-separated ids while preserving order", () => {
  assert.deepEqual(expandPreviewIds(["1429850,1430127", "1429850", " 1430999 "]), [
    "1429850",
    "1430127",
    "1430999",
  ]);
});
