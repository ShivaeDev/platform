#!/usr/bin/env node
import { runWithHeapLimit } from "#adapters/runWithHeapLimit.ts";

// Every rule reads one shared set of parsed trees, and the largest measured run keeps about 1.3 GB alive; without a limit V8 lets the heap grow to several times that before it collects.
runWithHeapLimit(2048, () => import("#cli/main.ts"));
