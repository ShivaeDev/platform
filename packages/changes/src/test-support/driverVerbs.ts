import { Context, Effect, Exit } from "effect";
import type { CommitFrame, Outcome } from "#frame.ts";
import { type Body, effectOf } from "./body.ts";
import { database, type Engine, labels } from "./engine.ts";
import { type Change, Current } from "./fakeDatabase.ts";

export const Note = Context.Reference<string>("ChangesStory/Note", { defaultValue: () => "no note" });

export interface DriverTransaction {
	readonly commit: () => Effect.Effect<void>;
	readonly ending: () => Effect.Effect<string>;
	readonly openSavepoint: () => Effect.Effect<DriverTransaction>;
	readonly record: (...changes: Change[]) => Effect.Effect<void>;
	readonly rollBack: () => Effect.Effect<void>;
	readonly run: <A, E, R>(body: Body<A, E, R>) => Effect.Effect<A, E, Exclude<R, Current>>;
	readonly runHook: (provided?: { readonly note: string }) => Effect.Effect<void, string>;
}

export function driverVerbs(engine: Engine, tell: (line: string) => void) {
	const channel = engine.channel();
	function main() {
		return database(engine, "main");
	}
	function noted<A, E, R>(effect: Effect.Effect<A, E, R>, provided: { readonly note: string } | undefined) {
		return provided === undefined ? effect : Effect.provideService(effect, Note, provided.note);
	}
	function transaction(name: string, frame: CommitFrame<string>): DriverTransaction {
		let ending = "open";
		function settle(outcome: Outcome, action: string, settled: string) {
			return Effect.gen(function* () {
				tell(`the driver ${action} ${name}`);
				const exit = yield* Effect.exit(frame.settle(outcome));
				ending = Exit.isSuccess(exit) ? settled : "died";
			});
		}
		return {
			commit: () => settle("committed", "commits", "committed"),
			ending: () => Effect.sync(() => ending),
			openSavepoint: () =>
				Effect.suspend(() => {
					tell(`the driver opens a savepoint in ${name}`);
					return Effect.map(Effect.provideService(frame.provide(channel.open), Current, main()), (child) => transaction("the savepoint", child));
				}),
			record: (...changes) =>
				Effect.suspend(() => {
					tell(`the driver records ${labels(changes).join(", ")} in ${name}`);
					return Effect.provideService(frame.provide(channel.record(changes)), Current, main());
				}),
			rollBack: () => settle("rolledBack", "rolls back", "rolled back"),
			run: (body) => Effect.provideService(frame.provide(effectOf(body)), Current, main()),
			runHook: (provided) =>
				Effect.suspend(() => {
					tell(`the driver runs the before-commit hook of ${name}${provided ? ` with ${provided.note}` : ""}`);
					return noted(frame.beforeCommit, provided);
				}),
		};
	}
	return {
		driverOpens: (provided?: { readonly note: string }) =>
			Effect.suspend(() => {
				tell(`a driver opens its own transaction on main${provided ? ` with ${provided.note}` : ""}`);
				return Effect.map(noted(Effect.provideService(channel.open, Current, main()), provided), (frame) => transaction("its transaction", frame));
			}),
		promiseDriver: <A, E>(outcome: "commits" | "fails to commit", body: Body<A, E, never>) =>
			Effect.gen(function* () {
				tell(`a Promise driver runs a transaction on main whose commit ${outcome === "commits" ? "lands" : "fails"}`);
				const frame = yield* Effect.provideService(channel.open, Current, main());
				const exit = yield* Effect.promise(() => Effect.runPromiseExit(frame.provide(Effect.tap(effectOf(body), () => frame.beforeCommit))));
				yield* frame.settle(outcome === "commits" && Exit.isSuccess(exit) ? "committed" : "rolledBack");
				return yield* exit;
			}),
	};
}
