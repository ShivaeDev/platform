import { Deferred, Effect, Fiber, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Diagnostics, DiagnosticsConfig, type diagnostics, SourceFailure, type Sources } from "#diagnostics/source.ts";
import { syntheticSources } from "./diagnostics.ts";

type Read = Effect.Success<ReturnType<typeof diagnostics>>;
type Snapshot = Effect.Success<Read>;
type Observed = Snapshot[keyof Sources];

interface DiagnosticsEngine {
	cancellation?: Fiber.Fiber<void>;
	gate?: { entered: Deferred.Deferred<void>; release: Deferred.Deferred<void> };
	offline: boolean;
	read?: Read;
	reads: Record<keyof Sources, number>;
	sources: Sources;
	readonly tabs: Fiber.Fiber<Snapshot>[];
}

function reading(engine: DiagnosticsEngine) {
	if (!engine.read) {
		throw new Error("Diagnostics have not started");
	}
	return engine.read;
}

function held(engine: DiagnosticsEngine) {
	if (!engine.gate) {
		throw new Error("No Codex read is held");
	}
	return engine.gate;
}

function stateOf(observed: Observed) {
	return observed.state === "ready" ? "ready" : `${observed.state}: ${observed.cause}`;
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
	create: (): DiagnosticsEngine => ({ offline: false, reads: { codex: 0, fleet: 0, github: 0 }, sources: syntheticSources(), tabs: [] }),
	inspect: (engine) => ({ offline: engine.offline, reads: engine.reads, tabs: engine.tabs.length }),
	name: "board diagnostics",
	stages: ["sources", "tabs"],
	verbs: (engine, story) => ({
		anotherTabReads: () =>
			Effect.gen(function* () {
				story.tell("another tab reads the diagnostics while Codex has not answered");
				engine.tabs.push(yield* Effect.forkChild(reading(engine)));
				yield* Effect.yieldNow;
			}),
		codexAnswers: () =>
			Effect.gen(function* () {
				story.tell("Codex answers the held read");
				yield* Deferred.succeed(held(engine).release, undefined);
				if (engine.cancellation) {
					yield* Fiber.join(engine.cancellation);
				}
			}),
		codexReads: () =>
			Effect.sync(() => {
				story.tell("the reader counts the Codex reads");
				return engine.reads.codex;
			}),
		codexRecovers: () =>
			Effect.sync(() => {
				story.tell("Codex becomes available again");
				engine.offline = false;
			}),
		codexWindows: () =>
			Effect.map(reading(engine), (snapshot) => {
				story.tell("a tab reads the Codex usage windows");
				return snapshot.codex.state === "ready" ? snapshot.codex.value : stateOf(snapshot.codex);
			}),
		firstTabCloses: () =>
			Effect.gen(function* () {
				story.tell("the first tab closes while its Codex read is held");
				const first = engine.tabs[0];
				if (!first) {
					throw new Error("No tab is reading");
				}
				engine.cancellation = yield* Effect.forkChild(Fiber.interrupt(first));
				yield* Effect.yieldNow;
			}),
		secondsPass: (seconds: number) => {
			story.tell(`${seconds} seconds pass`);
			return TestClock.adjust(`${seconds} seconds`);
		},
		sourceReads: () =>
			Effect.sync(() => {
				story.tell("the reader counts the reads of each source");
				return { ...engine.reads };
			}),
		sourceStates: () =>
			Effect.map(reading(engine), (snapshot) => {
				story.tell("a tab reads the board's diagnostics");
				return { codex: stateOf(snapshot.codex), fleet: stateOf(snapshot.fleet), github: stateOf(snapshot.github) };
			}),
		tabReads: () =>
			Effect.map(reading(engine), (snapshot) => {
				story.tell("a tab reads the board's diagnostics");
				return stateOf(snapshot.codex);
			}),
		waitingTabsSeeCodex: () =>
			Effect.gen(function* () {
				story.tell("the reader reads the Codex state each waiting tab received");
				const answers: string[] = [];
				for (const tab of engine.tabs) {
					answers.push(stateOf((yield* Fiber.join(tab)).codex));
				}
				return answers;
			}),
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

export function aTabReadDiagnostics() {
	return diagnosticsStory.trait("tabs", "a tab has read the diagnostics once", function* (engine) {
		yield* reading(engine);
	});
}

export function aTabWaitingOnCodex() {
	return diagnosticsStory.traits(
		diagnosticsStory.trait("sources", "Codex holds its next answer", function* (engine) {
			engine.gate = { entered: yield* Deferred.make<void>(), release: yield* Deferred.make<void>() };
		}),
		diagnosticsStory.trait("tabs", "a tab reads the diagnostics and waits on Codex", function* (engine) {
			engine.tabs.push(yield* Effect.forkChild(reading(engine)));
			yield* Deferred.await(held(engine).entered);
		}),
	);
}
