import { Effect } from "effect";
import { type Body, effectOf } from "./body.ts";
import { database, type Engine, labels } from "./engine.ts";
import { type Change, Current, type FakeDatabase } from "./fakeDatabase.ts";

export const REJECTED = "rejected";

function rejectedBy(error: unknown): error is typeof REJECTED {
	return error === REJECTED;
}

export function databaseActions(engine: Engine, tell: (line: string) => void) {
	const channel = engine.channel();
	function on(owner: FakeDatabase) {
		return <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.provideService(Current, owner), Effect.provide(engine.logs.layer));
	}
	function transaction<A, E, R>(owner: FakeDatabase, body: Effect.Effect<A, E, R>) {
		return on(owner)(channel.within<A, E, R, E | string, R>(owner.transaction)(body));
	}
	function databaseVerbs(name: string) {
		function owner() {
			return database(engine, name);
		}
		return {
			committedRows: () => Effect.sync(() => [...owner().committed]),
			inTransaction: <A, E, R>(body: Body<A, E, R>) =>
				Effect.suspend(() => {
					tell(`${name} begins a transaction`);
					return Effect.asVoid(transaction(owner(), effectOf(body))).pipe(Effect.catchIf(rejectedBy, () => Effect.void));
				}),
			record: (...changes: Change[]) =>
				Effect.suspend(() => {
					tell(`${name} records ${labels(changes).join(", ") || "no changes"}`);
					return on(owner())(channel.record(changes));
				}),
			write: (row: string, ...changes: Change[]) =>
				Effect.suspend(() => {
					tell(`${name} writes ${row}`);
					return on(owner())(Effect.andThen(owner().write(row), channel.record(changes)));
				}),
		};
	}
	return { database: databaseVerbs, on, transaction };
}
