import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { SourceFailure } from "#diagnostics/source.ts";
import { configuredSources, diagnosticsStory, offlineCodex, pendingCodex } from "#test/diagnosticsStory.ts";

for (const source of ["codex", "github", "fleet"] as const) {
	for (const kind of ["not-configured", "error"] as const) {
		diagnosticsStory.it(
			`${source} ${kind} leaves other sources readable`,
			[configuredSources({ [source]: Effect.fail(new SourceFailure({ kind, message: "Provider unavailable" })) })],
			function* ({ readDiagnostics }) {
				const result = yield* readDiagnostics();
				expect(result[source]).toMatchObject({ cause: "Provider unavailable", state: kind });
				for (const other of (["codex", "github", "fleet"] as const).filter((candidate) => candidate !== source)) {
					expect(result[other].state).toBe("ready");
				}
			},
		);
	}
}

diagnosticsStory.it(
	"concurrent tabs share Codex reads for one minute and refresh Fleet and GitHub each time",
	[pendingCodex()],
	function* ({ readDiagnostics, codexEntered, releaseCodex, sourceReads, advance }) {
		const first = yield* Effect.forkChild(readDiagnostics());
		yield* codexEntered();
		const second = yield* Effect.forkChild(readDiagnostics());
		yield* releaseCodex();
		expect(yield* Fiber.join(first)).toMatchObject({ codex: { state: "ready" } });
		yield* Fiber.join(second);
		expect(sourceReads().codex).toBe(1);
		yield* advance(59_000);
		yield* readDiagnostics();
		expect(sourceReads().codex).toBe(1);
		yield* advance(1000);
		yield* readDiagnostics();
		expect(sourceReads()).toEqual({ codex: 2, fleet: 4, github: 4 });
	},
);

diagnosticsStory.it(
	"failed Codex reads recover after their one-minute cache expires",
	[offlineCodex()],
	function* ({ readDiagnostics, recoverCodex, advance, sourceReads }) {
		expect((yield* readDiagnostics()).codex).toMatchObject({ cause: "Codex offline", state: "error" });
		recoverCodex();
		expect((yield* readDiagnostics()).codex.state).toBe("error");
		expect(sourceReads().codex).toBe(1);
		yield* advance(60_000);
		expect((yield* readDiagnostics()).codex.state).toBe("ready");
		expect(sourceReads().codex).toBe(2);
	},
);

diagnosticsStory.it(
	"a cancelled tab cannot poison the cache or spend another Codex request",
	[pendingCodex()],
	function* ({ readDiagnostics, codexEntered, releaseCodex, sourceReads }) {
		const first = yield* Effect.forkChild(readDiagnostics());
		yield* codexEntered();
		const cancellation = yield* Effect.forkChild(Fiber.interrupt(first));
		yield* Effect.yieldNow;
		yield* releaseCodex();
		yield* Fiber.join(cancellation);
		expect((yield* readDiagnostics()).codex.state).toBe("ready");
		expect(sourceReads().codex).toBe(1);
	},
);
