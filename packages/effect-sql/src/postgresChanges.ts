import { Context, type Duration, Effect, Layer, type Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { listenForChanges } from "./listenForChanges.ts";
import { encodeKeys } from "./notifyPayload.ts";
import { BeforeCommit, CommittedSink } from "./transact.ts";

export interface PostgresChangeClient extends SqlClient.SqlClient {
	readonly listen: (channel: string) => Stream.Stream<string, SqlError>;
}

export interface PostgresChangesOptions {
	readonly channel: string;
	readonly client: PostgresChangeClient;
	readonly heartbeatInterval?: Duration.Input;
	readonly heartbeatTimeout?: Duration.Input;
	readonly resync: Effect.Effect<void>;
	readonly retryDelay?: Duration.Input;
}

export function postgresChanges(options: PostgresChangesOptions) {
	return Layer.effectContext(
		Effect.gen(function* () {
			yield* listenForChanges(options);
			const notify = Effect.fn("PostgresChanges.notify")(function* (keys: readonly unknown[]) {
				const sql = yield* SqlClient.SqlClient;
				if (sql.transactionService !== options.client.transactionService) {
					return;
				}
				const payloads = yield* encodeKeys(keys);
				for (const payload of payloads) {
					yield* sql`select pg_notify(${options.channel}, ${payload})`;
				}
			});
			function committed(keys: readonly unknown[]) {
				return Effect.flatMap(SqlClient.SqlClient, (sql) =>
					sql.transactionService === options.client.transactionService ? Effect.void : Reactivity.invalidate(keys),
				);
			}
			return Context.make(BeforeCommit, notify).pipe(Context.add(CommittedSink, committed));
		}),
	);
}
