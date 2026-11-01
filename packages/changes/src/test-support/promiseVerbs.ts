import { Deferred, Effect, Exit, Fiber } from "effect";
import { type Body, effectOf } from "./body.ts";
import { Note } from "./driverVerbs.ts";
import { COMMIT_REFUSED, database, type Engine, endingOf } from "./engine.ts";
import { Current } from "./fakeDatabase.ts";

async function transact<A>(callback: () => Promise<A>, commit: () => Promise<void>): Promise<A> {
	const value = await callback();
	await commit();
	return value;
}

export function promiseVerbs(engine: Engine, tell: (line: string) => void) {
	const channel = engine.channel();
	function run<A, E, R>(body: Body<A, E, R>) {
		return Effect.gen(function* () {
			tell("the Promise driver runs the callback, then attempts its commit");
			const frame = yield* Effect.provideService(channel.open, Current, database(engine, "main"));
			const context = yield* Effect.context<R>();
			function callback() {
				return Effect.runPromiseWith(context)(frame.provide(Effect.tap(effectOf(body), () => frame.beforeCommit)));
			}
			const exit = yield* Effect.exit(
				Effect.tryPromise({
					catch: (error) => (error instanceof Error ? error.message : String(error)),
					try: () => transact(callback, engine.promiseCommit),
				}),
			);
			engine.promiseExit = exit;
			yield* frame.settle(Exit.isSuccess(exit) ? "committed" : "rolledBack");
		}).pipe(Effect.uninterruptible);
	}
	function gate() {
		if (engine.promiseGate === undefined) {
			throw new Error("Declare promiseCommitWaits() before controlling a Promise commit");
		}
		return engine.promiseGate;
	}
	return {
		callbackNotes: () => Effect.sync(() => [...engine.callbackNotes]),
		finishPromiseCommit: () =>
			Effect.sync(() => {
				tell("the Promise driver's commit resolves");
				gate().release.resolve();
			}),
		noteCaller: () =>
			Effect.map(Note, (note) => {
				engine.callbackNotes.push(`body: ${note}`);
			}),
		promiseDriver: run,
		promiseEnding: () =>
			Effect.gen(function* () {
				if (engine.promiseFiber !== undefined) {
					yield* Fiber.await(engine.promiseFiber);
				}
				return endingOf(engine.promiseExit);
			}),
		rejectPromiseCommit: () =>
			Effect.sync(() => {
				tell("the Promise driver's commit rejects");
				gate().release.reject(new Error(COMMIT_REFUSED));
			}),
		startPromiseDriver: <A, E, R>(body: Body<A, E, R>) =>
			Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(run(body));
				engine.promiseFiber = fiber;
				yield* Effect.raceFirst(Deferred.await(gate().begun), Effect.asVoid(Fiber.await(fiber)));
			}),
		withCallerNote: <A, E, R>(note: string, body: Body<A, E, R>) => Effect.provideService(effectOf(body), Note, note),
	};
}
