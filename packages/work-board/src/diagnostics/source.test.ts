import { Clock, Deferred, Effect, Fiber, Layer } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { syntheticSources } from "#test/diagnostics.ts";
import { Diagnostics, DiagnosticsConfig, SourceFailure, type Sources } from "./source.ts";

const diagnostics = Effect.fn("Test.diagnostics")(function* (sources: Sources) {
	const context = yield* Layer.build(Diagnostics.layer.pipe(Layer.provide(Layer.succeed(DiagnosticsConfig, { _tag: "Sources", sources }))));
	return Effect.flatMap(Diagnostics, (service) => service.read()).pipe(Effect.provideContext(context));
});

for (const source of ["codex", "github", "fleet"] as const) {
	for (const kind of ["not-configured", "error"] as const) {
		it.live(`${source} ${kind} retains its cause without affecting the other sources`, function* () {
			const read = yield* diagnostics(syntheticSources({ [source]: Effect.fail(new SourceFailure({ kind, message: "Synthetic source cause" })) }));
			const result = yield* read;
			expect(result[source]).toMatchObject({ cause: "Synthetic source cause", state: kind });
			for (const other of (["codex", "github", "fleet"] as const).filter((candidate) => candidate !== source)) {
				expect(result[other].state).toBe("ready");
			}
		});
	}
}

it.live("concurrent tabs share one GitHub read per minute and Fleet is read on each refresh", function* () {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	let githubReads = 0;
	let fleetReads = 0;
	const sources = syntheticSources();
	let now = 0;
	const clock = yield* Clock.Clock;
	const cachedClock: Clock.Clock = {
		currentTimeMillis: Effect.sync(() => now),
		currentTimeMillisUnsafe: () => now,
		currentTimeNanos: Effect.sync(() => BigInt(now) * 1000000n),
		currentTimeNanosUnsafe: () => BigInt(now) * 1000000n,
		monotonicTimeNanos: Effect.sync(() => BigInt(now) * 1000000n),
		monotonicTimeNanosUnsafe: () => BigInt(now) * 1000000n,
		sleep: (duration) => clock.sleep(duration),
	};
	const read = yield* diagnostics({
		...sources,
		fleet: Effect.sync(() => {
			fleetReads += 1;
		}).pipe(Effect.andThen(sources.fleet)),
		github: Effect.sync(() => {
			githubReads += 1;
		}).pipe(Effect.andThen(Deferred.succeed(entered, undefined)), Effect.andThen(Deferred.await(release)), Effect.andThen(sources.github)),
	}).pipe(Effect.provideService(Clock.Clock, cachedClock));
	const first = yield* read.pipe(Effect.provideService(Clock.Clock, cachedClock), Effect.forkChild);
	yield* Deferred.await(entered);
	const second = yield* read.pipe(Effect.provideService(Clock.Clock, cachedClock), Effect.forkChild);
	yield* Deferred.succeed(release, undefined);
	expect(yield* Fiber.join(first)).toMatchObject({ github: { state: "ready" } });
	yield* Fiber.join(second);
	expect(githubReads).toBe(1);
	now = 59_000;
	yield* read.pipe(Effect.provideService(Clock.Clock, cachedClock));
	expect(githubReads).toBe(1);
	now = 60_000;
	yield* read.pipe(Effect.provideService(Clock.Clock, cachedClock));
	expect(githubReads).toBe(2);
	expect(fleetReads).toBe(4);
});

it.live("failed GitHub reads are cached and recover after a minute", function* () {
	let failing = true;
	let reads = 0;
	const sources = syntheticSources();
	let now = 0;
	const clock = yield* Clock.Clock;
	const cachedClock: Clock.Clock = {
		currentTimeMillis: Effect.sync(() => now),
		currentTimeMillisUnsafe: () => now,
		currentTimeNanos: Effect.sync(() => BigInt(now) * 1000000n),
		currentTimeNanosUnsafe: () => BigInt(now) * 1000000n,
		monotonicTimeNanos: Effect.sync(() => BigInt(now) * 1000000n),
		monotonicTimeNanosUnsafe: () => BigInt(now) * 1000000n,
		sleep: (duration) => clock.sleep(duration),
	};
	const read = yield* diagnostics({
		...sources,
		github: Effect.suspend(() => {
			reads += 1;
			return failing ? Effect.fail(new SourceFailure({ kind: "error", message: "GitHub offline" })) : sources.github;
		}),
	}).pipe(Effect.provideService(Clock.Clock, cachedClock));
	expect((yield* read.pipe(Effect.provideService(Clock.Clock, cachedClock))).github.state).toBe("error");
	failing = false;
	yield* read.pipe(Effect.provideService(Clock.Clock, cachedClock));
	expect(reads).toBe(1);
	now = 60_000;
	expect((yield* read.pipe(Effect.provideService(Clock.Clock, cachedClock))).github.state).toBe("ready");
	expect(reads).toBe(2);
});

it.live("a cancelled tab cannot poison the shared source cache or spend another GitHub request", function* () {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	let reads = 0;
	const sources = syntheticSources();
	const read = yield* diagnostics({
		...sources,
		github: Effect.sync(() => {
			reads += 1;
		}).pipe(Effect.andThen(Deferred.succeed(entered, undefined)), Effect.andThen(Deferred.await(release)), Effect.andThen(sources.github)),
	});
	const first = yield* read.pipe(Effect.forkChild);
	yield* Deferred.await(entered);
	const cancellation = yield* Fiber.interrupt(first).pipe(Effect.forkChild);
	yield* Effect.yieldNow;
	yield* Deferred.succeed(release, undefined);
	yield* Fiber.join(cancellation);
	expect((yield* read).github.state).toBe("ready");
	expect(reads).toBe(1);
});
