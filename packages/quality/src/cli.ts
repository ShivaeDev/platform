#!/usr/bin/env node
import process from "node:process";
import { program } from "#cli/program.ts";
import { runMain } from "#cli/run-main.ts";

runMain(program(process.argv.slice(2), { cwd: process.cwd(), launch: { options: process.execArgv, script: process.argv[1] ?? "" } }));
