import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyIntent, classifyResume } from "../src/runtime/intent.mjs";

test("fix-like requests classify as write", () => {
  assert.equal(classifyIntent("please fix the null deref"), "write");
  assert.equal(classifyIntent("实现这个功能"), "write");
});

test("investigate-like requests classify as read-only", () => {
  assert.equal(classifyIntent("investigate why it crashes"), "read-only");
  assert.equal(classifyIntent("分析这个 bug 的原因"), "read-only");
});

test("ambiguous defaults to read-only", () => {
  assert.equal(classifyIntent("the thing with the stuff"), "read-only");
});

test("explicit flags override classification", () => {
  assert.equal(classifyIntent("investigate", { write: true }), "write");
  assert.equal(classifyIntent("fix it", { "read-only": true }), "read-only");
});

test("resume detection", () => {
  assert.equal(classifyResume("continue the previous work"), "resume");
  assert.equal(classifyResume("继续上次的修复"), "resume");
  assert.equal(classifyResume("brand new task"), "fresh");
  assert.equal(classifyResume("continue", { fresh: true }), "fresh");
});
