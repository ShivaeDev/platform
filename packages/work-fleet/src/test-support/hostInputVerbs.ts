import { rmSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { Cause, Clock, Effect, Exit, Layer } from "effect";
import type { FleetHost } from "#host/config.ts";
import { loadHost } from "#host/configFile.ts";
import { continuationMessage } from "#host/continuationMessage.ts";
import { hostSql } from "#host/runtime.ts";
import { hostBoard } from "#test/fleetHost.ts";
import { hostProcess } from "#test/hostProcess.ts";
import { unavailableFleetItems } from "#test/unavailableFleetItems.ts";

const PROGRESS_DEADLINE = 20_000;

function failureText(exit: Exit.Exit<unknown, unknown>) {
	return Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "succeeded";
}

export function hostInputVerbs() {
	function configurationFolder(text?: string) {
		return Effect.acquireRelease(
			Effect.sync(() => hostBoard(text)),
			(path) => Effect.sync(() => rmSync(path, { force: true, recursive: true })),
		);
	}
	return {
		continuationMessage: (message?: string, chunks: readonly string[] = []) => continuationMessage(message, Readable.from(chunks)),
		interruptHostWait: () =>
			Effect.scoped(
				hostProcess("/synthetic/missing-config.json").pipe(
					Effect.flatMap((child) => child.until(() => Effect.interrupt)),
					Effect.exit,
					Effect.map((exit) => (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : "not interrupted")),
				),
			),
		invalidHostStartup: () =>
			Effect.scoped(
				Effect.gen(function* () {
					const started = yield* Clock.currentTimeMillis;
					const child = yield* configurationFolder("{").pipe(Effect.flatMap((path) => hostProcess(join(path, "fleet.config.json"))));
					const startup = failureText(yield* child.until(() => Effect.succeed(false)).pipe(Effect.exit));
					const kill = failureText(yield* child.kill.pipe(Effect.exit));
					const elapsed = (yield* Clock.currentTimeMillis) - started;
					return { kill, startup, timing: elapsed < PROGRESS_DEADLINE ? "before the progress deadline" : `after ${elapsed} ms` };
				}),
			),
		loadConfiguration: (text?: string, override?: string) => configurationFolder(text).pipe(Effect.flatMap((path) => loadHost(path, override))),
		openDatabase: (host: FleetHost) => Layer.build(hostSql(host)).pipe(Effect.scoped),
		unavailableFleetItems,
		writeConfigurationFile: (text: string) => configurationFolder(text).pipe(Effect.map((path) => join(path, "fleet.config.json"))),
	};
}
