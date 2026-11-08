import process from "node:process";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Exit, Path, Runtime } from "effect";
import { runAttempt } from "#runAttempt.ts";
import { vitestRunnerLayer } from "#vitest-runner/layer.ts";

const modulePath = Path.Path.pipe(Effect.flatMap((path) => path.fromFileUrl(new URL(import.meta.url))));

if (Effect.runSync(modulePath.pipe(Effect.provide(NodePath.layer))) === process.argv[1]) {
	const [attempt = "1", outputDir = ".", ...vitestArgs] = process.argv.slice(2);
	NodeRuntime.runMain(
		runAttempt({ attempt: Number(attempt), outputDir, vitestArgs }).pipe(
			Effect.catchTag("VitestRerunError", (error) =>
				Effect.as(Console.error(`vitest-rerun: ${error.message}`, ...(error.cause === undefined ? [] : [error.cause])), true),
			),
			Effect.provide(vitestRunnerLayer),
			Effect.provide(NodeServices.layer),
		),
		{ teardown: (exit, onExit) => (Exit.isSuccess(exit) ? onExit(Number(exit.value)) : Runtime.defaultTeardown(exit, onExit)) },
	);
}
