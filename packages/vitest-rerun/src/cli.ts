#!/usr/bin/env node
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { parseOptions } from "#options.ts";
import { rerun } from "#rerun.ts";

process.exitCode = await Effect.runPromise(
	parseOptions(process.argv.slice(2)).pipe(
		Effect.flatMap(rerun),
		Effect.catchTag("VitestRerunError", (error) => Effect.as(Console.error(`vitest-rerun: ${error.message}`), 2)),
		Effect.provide(NodeServices.layer),
	),
);
