#!/usr/bin/env node
import { runFake } from "./fake-lib.mjs";
process.exitCode = runFake({ name: "cursor", scenario: process.env.FAKE_CURSOR_SCENARIO || "approve" });
