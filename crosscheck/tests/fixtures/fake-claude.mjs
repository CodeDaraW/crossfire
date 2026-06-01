#!/usr/bin/env node
import { runFake } from "./fake-lib.mjs";
process.exitCode = runFake({ name: "claude", scenario: process.env.FAKE_CLAUDE_SCENARIO || "needs-attention" });
