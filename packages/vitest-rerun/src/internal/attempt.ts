import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { runAttempt } from "#internal/runAttempt.ts";

const [attempt = "1", outputDir = ".", ...vitestArgs] = process.argv.slice(2);
const failed = await Effect.runPromise(
	runAttempt({ attempt: Number(attempt), outputDir, vitestArgs }).pipe(
		Effect.catchTag("VitestRerunError", (error) =>
			Effect.as(Console.error(`vitest-rerun: ${error.message}`, ...(error.cause === undefined ? [] : [error.cause])), true),
		),
		Effect.provide(NodeServices.layer),
	),
);
if (failed) {
	process.exitCode = 1;
}
