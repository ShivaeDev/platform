import { Effect, Exit } from "effect";
import type { CommitFrame, Outcome } from "#frame.ts";
import { database, type Engine } from "./engine.ts";
import { on } from "./fakeDatabase.ts";

export function frameVerbs(engine: Engine, tell: (line: string) => void) {
	const channel = engine.channel();
	function open(owner = database(engine), parent?: CommitFrame<string>) {
		return Effect.gen(function* () {
			tell(`${owner.name} opens ${parent ? "a nested" : "a root"} frame`);
			const frame = yield* on(owner)(parent ? parent.provide(channel.open) : channel.open);
			return {
				beforeCommit: frame.beforeCommit,
				provide: <TValue, E, R>(body: Effect.Effect<TValue, E, R>) => on(owner)(frame.provide(body)),
				settle: (outcome: Outcome) =>
					Effect.suspend(() => {
						tell(`${owner.name} settles ${outcome}`);
						return frame.settle(outcome);
					}),
			};
		});
	}
	function driver<TValue, E, R>(body: Effect.Effect<TValue, E, R>, commits: boolean): Effect.Effect<Outcome, never, R> {
		return Effect.gen(function* () {
			tell(`a Promise driver will ${commits ? "commit" : "roll back"}`);
			const frame = yield* open();
			const context = yield* Effect.context<R>();
			const outcome = yield* Effect.promise(
				(): Promise<Outcome> =>
					Effect.runPromiseExitWith(context)(frame.provide(Effect.tap(body, () => frame.beforeCommit))).then((exit) =>
						commits && Exit.isSuccess(exit) ? "committed" : "rolledBack",
					),
			);
			yield* frame.settle(outcome);
			return outcome;
		});
	}
	return {
		driver,
		frame: (name: string) => {
			const frame = engine.frames.get(name);
			if (!frame) {
				throw new Error(`No frame named ${name}`);
			}
			return frame;
		},
		open,
	};
}
