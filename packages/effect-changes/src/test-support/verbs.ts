import { Deferred, Effect, Fiber, Layer } from "effect";
import { database, type Engine, label } from "./engine.ts";
import { type Change, type FakeDatabase, on } from "./fake-database.ts";
import { frameVerbs } from "./frameVerbs.ts";

export function verbs(engine: Engine, tell: (line: string) => void) {
	const channel = engine.channel();
	const main = database(engine);
	function inTransaction(owner = main) {
		return <TValue, E, R>(body: Effect.Effect<TValue, E, R>) =>
			Effect.suspend(() => {
				tell(`${owner.name} enters a transaction`);
				return on(owner)(channel.within<TValue, E, R, E | string, R>(owner.transaction)(body));
			});
	}
	function record(changes: Iterable<Change>, owner = main) {
		return Effect.suspend(() => {
			const entries = [...changes];
			tell(`${owner.name} records ${entries.map(label).join(", ") || "no changes"}`);
			return on(owner)(channel.record(entries));
		});
	}
	const sink = Layer.succeed(channel.Sink, engine.sink ?? (() => Effect.die("Declare hasSink before capturing delivery")));
	const observer = Layer.succeed(channel.Observer, engine.observer ?? (() => Effect.die("Declare hasObserver before observing")));

	return {
		batch: <TValue, E, R>(body: Effect.Effect<TValue, E, R>) =>
			Effect.suspend(() => {
				tell("a batch groups autocommitted changes");
				return on(main)(channel.batch(body));
			}),
		captured: engine.captured,
		committedSink: Layer.succeed(channel.CommittedSink, (changes: readonly Change[]) =>
			(engine.sink ?? (() => Effect.die("Declare hasSink before capturing delivery")))(changes),
		),
		database: main,
		guarded: engine.guarded,
		hooks: engine.hooks,
		inTransaction,
		interrupt: <TValue, E>(fiber: Fiber.Fiber<TValue, E>) =>
			Effect.suspend(() => {
				tell("the caller interrupts the work");
				return Fiber.interrupt(fiber);
			}),
		logs: engine.logs,
		main,
		observer,
		...frameVerbs(engine, tell),
		awaitCommit: () => (engine.gate ? Deferred.await(engine.gate.committing) : Effect.die("Declare commitPauses")),
		observing: <TValue, E, R>(body: Effect.Effect<TValue, E, R>) => Effect.provide(body, observer),
		owner: (name: string) => database(engine, name),
		published: engine.published,
		readPublished: () => {
			tell("the reader checks published changes");
			return engine.published;
		},
		record,
		releaseCommit: () => (engine.gate ? Deferred.succeed(engine.gate.release, undefined) : Effect.die("Declare commitPauses")),
		rollback: (reason = "rejected") =>
			Effect.suspend(() => {
				tell(`the body rejects: ${reason}`);
				return Effect.fail(reason);
			}),
		scopedHook: Layer.succeed(channel.BeforeCommit, (changes: readonly Change[]) => Effect.sync(() => engine.hooks.push(changes.map(label)))),
		seen: engine.observed,
		sink,
		timeline: engine.timeline,
		write: (owner: FakeDatabase, row: string, ...changes: readonly Change[]) =>
			Effect.suspend(() => {
				tell(`${owner.name} writes ${row}`);
				return on(owner)(Effect.andThen(owner.write(row), channel.record(changes)));
			}),
	};
}
