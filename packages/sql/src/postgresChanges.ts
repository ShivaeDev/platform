import { Context, type Duration, Effect, Layer, type Queue, type Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { CommandPublication, CommandPublicationError, type CommandPublisher } from "@shivaedev/changes/commandPublication.ts";
import { listenForChanges } from "#listenForChanges.ts";
import { encodeKeys, resyncPayload } from "#notifyPayload.ts";
import { PostgresChangeListener } from "#PostgresChangeListener.ts";
import { PostgresChangeResync } from "#PostgresChangeResync.ts";
import { BeforeCommit, CommittedSink, invalidateOnCommit, transact } from "#transact.ts";

export interface PostgresNotification {
	readonly payload: string;
}

export interface PostgresChangeClient extends SqlClient.SqlClient {
	readonly listen: (channel: string) => Effect.Effect<Queue.Dequeue<PostgresNotification, SqlError>, SqlError, Scope.Scope>;
}

export interface PostgresChangesOptions {
	readonly channel: string;
	readonly client: PostgresChangeClient;
	readonly connectionSetting?: string;
	readonly heartbeatInterval?: Duration.Input;
	readonly heartbeatTimeout?: Duration.Input;
	readonly listenerClient?: Pick<PostgresChangeClient, "listen">;
	readonly resync: Effect.Effect<number>;
	readonly retryDelay?: Duration.Input;
}

export function postgresChanges(options: PostgresChangesOptions) {
	return Layer.effectContext(
		Effect.gen(function* () {
			yield* listenForChanges(options).pipe(
				Effect.provideService(SqlClient.SqlClient, options.client),
				Effect.provideService(PostgresChangeListener, options.listenerClient ?? options.client),
				Effect.provideService(PostgresChangeResync, { resync: options.resync }),
			);
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
			const recover = options.resync.pipe(
				Effect.andThen(options.client`select pg_notify(${options.channel}, ${resyncPayload})`),
				Effect.catchCause((cause) => Effect.fail(new CommandPublicationError({ cause }))),
				Effect.asVoid,
			);
			const publication: CommandPublisher = {
				publish: (keys) =>
					invalidateOnCommit(keys).pipe(
						transact({ onSqlError: (error) => error }),
						Effect.provideService(SqlClient.SqlClient, options.client),
						Effect.catchCause((cause) => Effect.fail(new CommandPublicationError({ cause }))),
					),
				recover,
			};
			return Context.make(BeforeCommit, notify).pipe(Context.add(CommittedSink, committed), Context.add(CommandPublication, publication));
		}),
	);
}
