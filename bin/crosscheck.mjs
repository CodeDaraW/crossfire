#!/usr/bin/env node
import { main } from "../src/cli/main.mjs";

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code ?? 0;
  },
  (err) => {
    process.stderr.write(`crosscheck: fatal: ${err?.stack || err}\n`);
    process.exitCode = 1;
  },
);
