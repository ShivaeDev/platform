#!/usr/bin/env node
import process from "node:process";
import { runWithHeapLimit } from "#adapters/runWithHeapLimit.ts";
import { heapLimit, heapLimitReached } from "#cli/heapLimit.ts";

runWithHeapLimit(heapLimit(process.argv.slice(2)), heapLimitReached, () => import("#cli/main.ts"));
