import { Cause, Effect, Exit, Schema, Stream } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { Rpc, RpcGroup } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { LiveHint } from "@shivaedev/contract/live.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { AppChanges } from "#appHost.ts";

export interface ClientAbortState {
	applicationName: string;
	callbacks: number;
	commits: number;
	controller: AbortController;
	finalized: boolean;
	interrupted: boolean;
	registrations: Parameters<Reactivity.Reactivity["registerUnsafe"]>[0][];
	response?: Promise<Response>;
	table: string;
	waiters: (() => void)[];
	written: boolean;
}

export function changed(state: ClientAbortState) {
	for (const waiter of state.waiters.splice(0)) {
		waiter();
	}
}

export function observed(state: ClientAbortState, condition: () => boolean): Promise<void> {
	return new Promise((resolve) => {
		function check() {
			if (condition()) {
				resolve();
			} else {
				state.waiters.push(check);
			}
		}
		check();
	});
}
export const AbortApi = RpcGroup.make(
	Rpc.make("hold", { payload: { password: Schema.String }, success: Schema.Void }),
	Rpc.make("rows", { success: Schema.Array(Schema.Struct({ value: Schema.String })) }),
	Rpc.make("commit", { success: Schema.Void }),
	Rpc.make("reject", { error: Schema.String, success: Schema.Void }),
	Rpc.make("watch", { payload: { password: Schema.String }, stream: true, success: LiveHint }),
);
export const CHANGED_KEY = "abort_items";
export function abortHandlers(state: ClientAbortState) {
	const transaction = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into ${sql(state.table)} values ('abandoned')`;
		state.written = true;
		changed(state);
		yield* Effect.never;
	}).pipe(
		transact({ onSqlError: (error) => error }),
		Effect.orDie,
		Effect.onExit((exit) =>
			Effect.sync(() => {
				state.interrupted = Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause);
				state.finalized = true;
				changed(state);
			}),
		),
	);
	return AbortApi.toLayer({
		commit: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`insert into ${sql(state.table)} values ('committed')`;
				yield* invalidateOnCommit([CHANGED_KEY]);
			}).pipe(transact({ onSqlError: (error) => error }), Effect.orDie),
		hold: () => transaction,
		reject: () => Effect.fail("rejected"),
		rows: () => SqlClient.SqlClient.use((sql) => sql<{ value: string }>`select value from ${sql(state.table)}`).pipe(Effect.orDie),
		watch: () =>
			Stream.unwrap(Effect.map(AppChanges, (changes) => changes.stream([{ _tag: "List", collection: CHANGED_KEY }]))).pipe(
				Stream.onExit((exit) =>
					Effect.sync(() => {
						state.interrupted = Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause);
						state.finalized = true;
						changed(state);
					}),
				),
			),
	});
}
