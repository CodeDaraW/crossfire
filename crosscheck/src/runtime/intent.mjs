// Classify a rescue request into read-only vs write-capable, and detect
// follow-up/resume intent. Explicit flags always win over classification.

// English keywords need word boundaries (so "prefix" != "fix"); CJK keywords use
// plain substring matching because \b does not apply around CJK characters.
const WRITE_EN = /\b(fix|implement|apply|update|patch|refactor|add|remove|rename|migrate)\b/i;
const WRITE_CJK = /(修复|实现|修改|改掉|增加|删除|重构)/;
const READ_EN = /\b(review|diagnos\w*|investigat\w*|research|analyz\w*|analyse|explain|why)\b/i;
const READ_CJK = /(看看|分析|诊断|排查|为什么|调查)/;
const RESUME_EN = /\b(continue|keep going|resume|carry on|apply (the )?top fix)\b/i;
const RESUME_CJK = /(继续|接着|上次)/;

export function classifyIntent(text, flags = {}) {
  if (flags.write) return "write";
  if (flags["read-only"]) return "read-only";
  const t = text || "";
  const wantsWrite = WRITE_EN.test(t) || WRITE_CJK.test(t);
  const wantsRead = READ_EN.test(t) || READ_CJK.test(t);
  if (wantsWrite && !wantsRead) return "write";
  if (wantsRead && !wantsWrite) return "read-only";
  // Ambiguous: default to the safer read-only.
  return "read-only";
}

export function classifyResume(text, flags = {}) {
  if (flags.fresh) return "fresh";
  if (flags.resume || flags["resume-last"]) return "resume";
  const t = text || "";
  return RESUME_EN.test(t) || RESUME_CJK.test(t) ? "resume" : "fresh";
}
