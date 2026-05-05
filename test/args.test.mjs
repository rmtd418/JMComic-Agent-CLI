import test from "node:test";
import assert from "node:assert/strict";
import { asArray, asInt, parseArgs } from "../src/shared/args.js";

test("parseArgs parses flags, repeated values, and positionals", () => {
  const parsed = parseArgs(["--query", "love", "--tag", "中文", "--tag=纯爱", "tail", "--json"]);
  assert.equal(parsed.values.query, "love");
  assert.deepEqual(parsed.values.tag, ["中文", "纯爱"]);
  assert.equal(parsed.values.json, true);
  assert.deepEqual(parsed.positionals, ["tail"]);
});

test("asArray and asInt normalize CLI values", () => {
  assert.deepEqual(asArray(undefined), []);
  assert.deepEqual(asArray("x"), ["x"]);
  assert.equal(asInt("5", 10), 5);
  assert.equal(asInt(true, 10), 10);
});
