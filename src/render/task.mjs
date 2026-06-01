export function renderTaskText(r) {
  const lines = [];
  lines.push(`# Crossfire ${r.mode} task -> ${r.name}`);
  lines.push(`status: ${r.status}`);
  if (r.warnings?.length) {
    for (const w of r.warnings) lines.push(`WARNING: ${w}`);
  }
  if (r.touched_files?.length) {
    lines.push(`touched files:`);
    for (const f of r.touched_files) lines.push(`  - ${f}`);
  }
  if (r.sessionId) lines.push(`sessionId: ${r.sessionId}`);
  lines.push("");
  lines.push("----- executor output -----");
  lines.push((r.final_message || "").trim() || "(no output)");
  if (r.mode === "write") {
    lines.push("");
    lines.push("Note: changes were made by another agent. Consider running `crossfire review` on them.");
  }
  return lines.join("\n");
}
