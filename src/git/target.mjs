import { git, gitOut, repoRoot, isDirty } from "./repository.mjs";

/**
 * Resolve the review target (working-tree | branch | commit) from flags.
 * Returns { mode, repoRoot, base, mergeBase, commit, label, error }.
 */
export async function resolveTarget(flags, cwd) {
  const root = await repoRoot(cwd);
  if (!root) {
    return { error: "not a git repository (or any parent)" };
  }

  const scope = flags.scope || "auto";

  if (flags.commit) {
    const sha = await gitOut(["rev-parse", "--verify", `${flags.commit}^{commit}`], root);
    if (!sha) return { error: `commit not found: ${flags.commit}`, repoRoot: root };
    const parent = await gitOut(["rev-parse", `${sha}^`], root).catch(() => "");
    return { mode: "commit", repoRoot: root, commit: sha, parent, label: `commit ${sha.slice(0, 12)}` };
  }

  if (flags.base || scope === "branch") {
    const base = await resolveBase(flags.base, root);
    if (!base) return { error: "could not detect a base branch; pass --base <ref>", repoRoot: root };
    const mergeBase = await gitOut(["merge-base", base, "HEAD"], root);
    return { mode: "branch", repoRoot: root, base, mergeBase: mergeBase || base, label: `${base}...HEAD` };
  }

  if (scope === "working-tree") {
    return { mode: "working-tree", repoRoot: root, label: "working tree (uncommitted)" };
  }

  // auto
  if (await isDirty(root)) {
    return { mode: "working-tree", repoRoot: root, label: "working tree (uncommitted)" };
  }
  const base = await resolveBase(flags.base, root);
  if (base) {
    const mergeBase = await gitOut(["merge-base", base, "HEAD"], root);
    return { mode: "branch", repoRoot: root, base, mergeBase: mergeBase || base, label: `${base}...HEAD` };
  }
  return { mode: "working-tree", repoRoot: root, label: "working tree (clean: nothing to review)" };
}

async function resolveBase(explicit, root) {
  if (explicit) {
    const ok = await gitOut(["rev-parse", "--verify", explicit], root);
    return ok ? explicit : null;
  }
  // origin/HEAD -> origin/main -> origin/master -> main -> master
  const headRef = await gitOut(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], root);
  if (headRef) {
    const short = headRef.replace("refs/remotes/", "");
    if (await gitOut(["rev-parse", "--verify", short], root)) return short;
  }
  for (const cand of ["origin/main", "origin/master", "main", "master"]) {
    if (await gitOut(["rev-parse", "--verify", cand], root)) return cand;
  }
  return null;
}
