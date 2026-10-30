import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { runAttempt } from "#internal/runAttempt.ts";

if (fileURLToPath(import.meta.url) === process.argv[1]) {
	const [attempt = "1", outputDir = ".", ...vitestArgs] = process.argv.slice(2);
	const failed = await Effect.runPromise(
		runAttempt({ attempt: Number(attempt), outputDir, vitestArgs }).pipe(
			Effect.catchTag("VitestRerunError", (error) => Effect.as(Console.error(`vitest-rerun: ${error.message}`, error.cause), true)),
			Effect.provide(NodeServices.layer),
		),
	);
	if (failed) {
		process.exitCode = 1;
	}
}
