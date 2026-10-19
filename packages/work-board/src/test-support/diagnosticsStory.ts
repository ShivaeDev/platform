import { Deferred, Effect, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Diagnostics, DiagnosticsConfig, type diagnostics, SourceFailure, type Sources } from "#diagnostics/source.ts";
import { syntheticSources } from "./diagnostics.ts";

interface DiagnosticsEngine {
	gate?: { entered: Deferred.Deferred<void>; release: Deferred.Deferred<void> };
	offline: boolean;
	read?: Effect.Success<ReturnType<typeof diagnostics>>;
	reads: Record<keyof Sources, number>;
	sources: Sources;
}
function reading(engine: DiagnosticsEngine) {
	if (!engine.read) {
		throw new Error("Diagnostics have not started");
	}
	return engine.read;
}
export const diagnosticsStory = storyKit({
	after: {
		*sources(engine) {
			const sources: Sources = {
				codex: Effect.gen(function* () {
					engine.reads.codex += 1;
					if (engine.gate) {
						yield* Deferred.succeed(engine.gate.entered, undefined);
						yield* Deferred.await(engine.gate.release);
					}
					if (engine.offline) {
						return yield* new SourceFailure({ kind: "error", message: "Codex offline" });
					}
					return yield* engine.sources.codex;
				}),
				fleet: Effect.suspend(() => {
					engine.reads.fleet += 1;
					return engine.sources.fleet;
				}),
				github: Effect.suspend(() => {
					engine.reads.github += 1;
					return engine.sources.github;
				}),
			};
			const context = yield* Layer.build(Diagnostics.layer.pipe(Layer.provide(Layer.succeed(DiagnosticsConfig, { _tag: "Sources", sources }))));
			engine.read = Effect.flatMap(Diagnostics, (service) => service.read()).pipe(Effect.provideContext(context));
		},
	},
	create: (): DiagnosticsEngine => ({ offline: false, reads: { codex: 0, fleet: 0, github: 0 }, sources: syntheticSources() }),
	inspect: (engine) => ({ offline: engine.offline, reads: engine.reads }),
	name: "board diagnostics",
	stages: ["sources"],
	verbs: (engine, story) => ({
		advance: (milliseconds: number) => {
			story.tell(`${milliseconds} milliseconds pass`);
			return TestClock.adjust(milliseconds);
		},
		codexEntered: () => {
			if (!engine.gate) {
				throw new Error("No Codex read is held");
			}
			return Deferred.await(engine.gate.entered);
		},
		readDiagnostics: () => {
			story.tell("a tab reads the board's diagnostics service");
			return reading(engine);
		},
		recoverCodex: () => {
			story.tell("Codex becomes available again");
			engine.offline = false;
		},
		releaseCodex: () => {
			story.tell("Codex finishes the pending read");
			if (!engine.gate) {
				throw new Error("No Codex read is held");
			}
			return Deferred.succeed(engine.gate.release, undefined);
		},
		sourceReads: () => ({ ...engine.reads }),
	}),
});
export function configuredSources(sources: Partial<Sources>) {
	return diagnosticsStory.trait("sources", "provider boundaries supply the configured observations", (engine) => {
		engine.sources = syntheticSources(sources);
	});
}
export function offlineCodex() {
	return diagnosticsStory.trait("sources", "Codex is offline", (engine) => {
		engine.offline = true;
	});
}
export function pendingCodex() {
	return diagnosticsStory.trait("sources", "the Codex response is held", function* (engine) {
		engine.gate = { entered: yield* Deferred.make<void>(), release: yield* Deferred.make<void>() };
	});
}
