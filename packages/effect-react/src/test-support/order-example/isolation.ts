import { type Context, Effect, type Scope, Semaphore } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { reset, StoryDatabase } from "./postgres.ts";

export type DatabaseMode =
	| { readonly transport: "http"; readonly reset: "truncate"; readonly commit: "real" }
	| { readonly transport: "local"; readonly reset: "rollback"; readonly commit: "rollback" };

export const wholeStack: DatabaseMode = { commit: "real", reset: "truncate", transport: "http" };
export const localRollback: DatabaseMode = { commit: "rollback", reset: "rollback", transport: "local" };

export function rollback<A, E, R>(effect: Effect.Effect<A, E, R>) {
	const sentinel = {};
	return effect.pipe(
		Effect.flatMap((value) => Effect.fail({ sentinel, value })),
		transact({ onSqlError: (error) => error }),
		Effect.catchIf(
			(error): error is { readonly sentinel: typeof sentinel; readonly value: A } =>
				typeof error === "object" && error !== null && "sentinel" in error && error.sentinel === sentinel,
			({ value }) => Effect.succeed(value),
		),
	);
}

function rolledBack<A, E, R>(effect: Effect.Effect<A, E, R>, database: Context.Service.Shape<typeof StoryDatabase>) {
	return rollback(effect).pipe(
		Effect.provideService(SqlClient.SqlClient, database.sql),
		Effect.provide(Reactivity.layer),
		Effect.tap(() =>
			Effect.gen(function* () {
				expect(yield* database.observer`select id from orders`, "rollback before cleanup truncation").toEqual([]);
			}),
		),
	);
}

const stories = Semaphore.makeUnsafe(1);

export function isolate(mode: DatabaseMode) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, unknown, R | StoryDatabase | Scope.Scope> =>
		stories.withPermits(1)(
			Effect.gen(function* () {
				const database = yield* StoryDatabase;
				const scoped: Effect.Effect<A, unknown, R> = Effect.scoped(effect);
				const body = mode.commit === "real" ? scoped : rolledBack(scoped, database);
				return yield* Effect.acquireUseRelease(
					reset(database),
					() => body,
					() => reset(database).pipe(Effect.orDie),
				);
			}),
		);
}
