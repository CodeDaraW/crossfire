import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

async function asset(path) {
  return readFile(join(ROOT, path), "utf8");
}

test("review host commands require named reviewer parsing", async () => {
  for (const host of ["cursor", "claude"]) {
    for (const name of ["crossfire-review.md", "crossfire-adversarial-review.md"]) {
      const text = await asset(`hosts/${host}/commands/${name}`);
      assert.match(text, /Known reviewers are `claude`, `codex`, and `cursor`/);
      assert.match(text, /--reviewer <comma-separated-reviewers>/);
      assert.match(text, /contains a reviewer mention/);
      assert.doesNotMatch(text, /```bash\ncrossfire (?:adversarial-)?review --self \w+ "?\$ARGUMENTS"?\n```/);
    }
  }
});

test("rescue host commands require named executor parsing", async () => {
  for (const host of ["cursor", "claude"]) {
    const text = await asset(`hosts/${host}/commands/crossfire-rescue.md`);
    assert.match(text, /Known executors are `claude`, `codex`, and `cursor`/);
    assert.match(text, /--executor <executor>|--executor codex/);
    assert.doesNotMatch(text, /```bash\ncrossfire rescue --self \w+ "?\$ARGUMENTS"?\n```/);
  }
});
