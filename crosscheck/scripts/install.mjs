#!/usr/bin/env node
import { install } from "../src/install/install.mjs";

const copy = process.argv.includes("--copy");
const res = await install({ copy });
process.stdout.write(`Installed ${res.installed.length} item(s):\n`);
for (const i of res.installed) process.stdout.write(`  + [${i.host}/${i.kind}] ${i.path}\n`);
for (const s of res.skipped) process.stdout.write(`  - skipped [${s.host}/${s.kind}]: ${s.reason}\n`);
