/**
 * Recommend foreground (wait) vs background based on collected context.
 * Conservative: only recommend wait for very small changes.
 */
export function recommendMode(context, config) {
  const threshold = config?.jobs?.default_background_threshold_files ?? 3;
  const files = context.changed_files?.length ?? 0;
  const diffBytes = Buffer.byteLength(context.diff || "", "utf8");
  const small = files > 0 && files <= 2 && !context.truncated && diffBytes < 8192;
  return small ? "wait" : "background";
}
