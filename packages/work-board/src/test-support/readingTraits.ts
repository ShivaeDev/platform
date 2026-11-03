import { spawn } from "node:child_process";
import { utimesSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Clock, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import type { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import type { CodexLimits, Sources } from "#diagnostics/source.ts";
import { fleetHealth } from "#server/adapters/fleetHealth.ts";
import { codexLimits } from "#server/diagnostics/codexLimits.ts";
import { codexRateLimits } from "#server/diagnostics/codexRateLimits.ts";
import { boardStory } from "./boardStory.ts";
import { syntheticSources } from "./diagnostics.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";
import { healthReadingFolder } from "./healthReadingFolder.ts";

export function readingTime(milliseconds: number) {
	return boardStory.trait("project", `the reader observes diagnostics at ${milliseconds}`, (engine) => {
		engine.readAt = milliseconds;
	});
}

export function codexProvider(mode: string, timeoutMs = 2000) {
	const read = codexRateLimits(
		() => spawn(process.execPath, [fileURLToPath(new URL("./codexAppServer.ts", import.meta.url)), mode], { stdio: "pipe" }),
		timeoutMs,
	);
	return diagnosticsSources(syntheticSources({ codex: codexLimits(mode === "timeout" ? driveProviderDeadline(read, timeoutMs) : read) }));
}

export function healthBoundary(kind: Parameters<typeof healthReadingFolder>[0]) {
	return boardStory.trait("project", `Fleet publishes an invalid ${kind} snapshot`, function* (engine) {
		const files = yield* Effect.acquireRelease(
			Effect.sync(() => healthReadingFolder(kind)),
			(acquired) => Effect.sync(acquired.remove),
		);
		engine.sources = syntheticSources({ fleet: fleetHealth(files.root) });
	});
}

export function modifiedNotes(modified: ReadonlyMap<string, number>) {
	return boardStory.trait("project", "the notes retain their authored modification times", (engine) => {
		for (const [file, milliseconds] of modified) {
			utimesSync(join(engine.notes.root, file), milliseconds / 1000, milliseconds / 1000);
		}
	});
}

export function diagnosticsSources(sources: Sources | ((root: string) => Sources)) {
	return boardStory.trait("project", "diagnostics read the configured provider boundaries", (engine) => {
		engine.sources = typeof sources === "function" ? sources(engine.notes.root) : sources;
	});
}

export function daemonSnapshot(read: (observedAt: number) => DiagnosticsSnapshot, stopped = false) {
	return boardStory.trait(
		"project",
		stopped ? "the diagnostics daemon has stopped" : "the diagnostics daemon publishes observations",
		function* (engine) {
			const observedAt = yield* Clock.currentTimeMillis;
			const daemon = yield* diagnosticsDaemon(() => read(observedAt));
			engine.fleetPort = daemon.port;
			if (stopped) {
				yield* daemon.stop();
			}
		},
	);
}

export function codexOnlySnapshot(observedAt: number, value: CodexLimits) {
	const missing = { cause: "Missing", observedAt, state: "not-configured" as const };
	return daemonSnapshot(() => ({ codex: { observedAt, state: "ready", value }, fleet: missing, github: missing }));
}

const driveProviderDeadline = Effect.fn("Story.driveProviderDeadline")(function* (read: ReturnType<typeof codexRateLimits>, timeoutMs: number) {
	const waiting = yield* Effect.forkChild(read);
	yield* TestClock.adjust(timeoutMs);
	return yield* Fiber.join(waiting);
});
