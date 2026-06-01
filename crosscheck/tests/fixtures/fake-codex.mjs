#!/usr/bin/env node
import { runFake } from "./fake-lib.mjs";
process.exitCode = runFake({ name: "codex", scenario: process.env.FAKE_CODEX_SCENARIO || "critical" });
