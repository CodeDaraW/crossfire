import { git, gitOut } from "./repository.mjs";

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function isSecretPath(path, patterns) {
  const base = path.split("/").pop() || path;
  return patterns.some((p) => globToRegExp(p).test(base) || globToRegExp(p).test(path));
}

/**
 * Collect review context for the resolved target.
 * Returns a structured object plus a `text` field ready to inline in a prompt.
 */
export async function collectContext(target, config, options = {}) {
  const root = target.repoRoot;
  const ctx = config.context;
  const excludeDir = options.excludeDir || null;
  const out = {
    context_mode: "inline-full",
    truncated: false,
    omitted_files: [],
    changed_files: [],
    diff_stat: "",
    status_text: "",
    diff: "",
    untracked_text: "",
  };

  // Resolve changed-file names FIRST so secret files can be excluded from the
  // diff at collection time (not merely flagged afterwards).
  let nameArgs;
  if (target.mode === "branch") nameArgs = ["diff", "--name-only", `${target.mergeBase}...HEAD`];
  else if (target.mode === "commit") nameArgs = ["show", "--name-only", "--format=", target.commit];
  else nameArgs = ["diff", "--name-only", "HEAD"];
  const namesRaw = await gitOut(nameArgs, root);
  const underExclude = (f) => excludeDir && (f === excludeDir || f.startsWith(`${excludeDir}/`));
  out.changed_files = namesRaw ? namesRaw.split("\n").filter(Boolean).filter((f) => !underExclude(f)) : [];

  const secretFiles = out.changed_files.filter((f) => isSecretPath(f, ctx.secret_path_patterns));
  if (secretFiles.length) {
    out.omitted_files.push(...secretFiles.map((f) => ({ file: f, reason: "secret-path-redacted" })));
  }
  // Pathspec that excludes secret files (and the crosscheck state dir, if it
  // lives inside the repo) from every diff/stat command below.
  const excludeSpecs = [
    ...secretFiles.map((f) => `:(exclude)${f}`),
    ...(excludeDir ? [`:(exclude)${excludeDir}`, `:(exclude)${excludeDir}/**`] : []),
  ];
  const exclude = excludeSpecs.length ? ["--", ".", ...excludeSpecs] : [];

  if (target.mode === "working-tree") {
    out.status_text = await gitOut(["status", "--porcelain=v1", "--untracked-files=all", ...exclude], root);
    const staged = await gitOut(["diff", "--cached", ...exclude], root);
    const unstaged = await gitOut(["diff", ...exclude], root);
    out.diff = [staged, unstaged].filter(Boolean).join("\n");
    out.diff_stat = await gitOut(["diff", "--stat", "HEAD", ...exclude], root);
    out.untracked_text = await collectUntracked(root, ctx, out, underExclude);
  } else if (target.mode === "branch") {
    const range = `${target.mergeBase}...HEAD`;
    out.diff = await gitOut(["diff", range, ...exclude], root);
    out.diff_stat = await gitOut(["diff", "--stat", range, ...exclude], root);
    out.status_text = await gitOut(["log", "--oneline", range], root);
  } else if (target.mode === "commit") {
    out.diff = await gitOut(["show", "--format=medium", target.commit, ...exclude], root);
    out.diff_stat = await gitOut(["show", "--stat", "--format=short", target.commit, ...exclude], root);
  }

  // Choose context mode based on diff size.
  const diffBytes = Buffer.byteLength(out.diff, "utf8");
  if (diffBytes > ctx.max_inline_diff_bytes) {
    out.context_mode = out.changed_files.length > 40 ? "repo-readonly" : "inline-summary";
    out.truncated = true;
    out.diff = out.diff.slice(0, ctx.max_inline_diff_bytes) + "\n... [diff truncated] ...\n";
  }

  out.text = renderContextText(target, out);
  return out;
}

async function collectUntracked(root, ctx, out, underExclude = () => false) {
  const listing = await gitOut(["ls-files", "--others", "--exclude-standard"], root);
  const files = listing ? listing.split("\n").filter(Boolean) : [];
  const chunks = [];
  for (const f of files) {
    if (underExclude(f)) continue;
    out.changed_files.push(f);
    if (isSecretPath(f, ctx.secret_path_patterns)) {
      chunks.push(`### untracked ${f}\n[redacted: secret-path]`);
      out.omitted_files.push({ file: f, reason: "secret-path-redacted" });
      continue;
    }
    const res = await git(["check-attr", "binary", "--", f], root);
    if (res.ok && /: binary: set/.test(res.stdout)) {
      chunks.push(`### untracked ${f}\n[binary file omitted]`);
      out.omitted_files.push({ file: f, reason: "binary" });
      continue;
    }
    try {
      const { readFile, stat } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const full = join(root, f);
      const st = await stat(full);
      if (st.size > ctx.max_untracked_file_bytes) {
        chunks.push(`### untracked ${f}\n[file too large: ${st.size} bytes, path recorded only]`);
        out.omitted_files.push({ file: f, reason: "too-large", size: st.size });
        continue;
      }
      const content = await readFile(full, "utf8");
      chunks.push(`### untracked ${f}\n${content}`);
    } catch {
      chunks.push(`### untracked ${f}\n[unreadable]`);
    }
  }
  return chunks.join("\n\n");
}

function renderContextText(target, out) {
  const parts = [];
  parts.push(`Target: ${target.label} (mode: ${target.mode})`);
  if (out.diff_stat) parts.push(`\nDiff stat:\n${out.diff_stat}`);
  if (out.changed_files.length) parts.push(`\nChanged files:\n${out.changed_files.join("\n")}`);
  if (out.status_text) parts.push(`\nStatus / commits:\n${out.status_text}`);
  if (out.diff) parts.push(`\nDiff:\n${out.diff}`);
  if (out.untracked_text) parts.push(`\nUntracked content:\n${out.untracked_text}`);
  if (out.truncated) parts.push(`\n[NOTE] Context was truncated; lower confidence for areas not shown.`);
  return parts.join("\n");
}

export function isEmptyContext(out) {
  return !out.diff && !out.untracked_text && out.changed_files.length === 0;
}
