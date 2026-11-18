import { Context, type Duration, Effect, Layer, Option, type Queue, type Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { CommandPublication, CommandPublicationError, type CommandPublisher } from "@shivaedev/changes/commandPublication.ts";
import type { SyncToken } from "@shivaedev/changes/syncToken.ts";
import { listenForChanges } from "#listenForChanges.ts";
import { encodeKeys, encodeSync, resyncPayload } from "#notifyPayload.ts";
import { PostgresChangeListener } from "#PostgresChangeListener.ts";
import { PostgresChangeResync } from "#PostgresChangeResync.ts";
import { PostgresChangeSync } from "#PostgresChangeSync.ts";
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
	readonly synced: (token: SyncToken) => Effect.Effect<void>;
}

// The publisher's own notify transaction sends this payload after its keys, so a sync token never overtakes them.
const TrailingNotification = Context.Reference<string | undefined>("@shivaedev/sql/TrailingNotification", { defaultValue: () => undefined });

export function postgresChanges(options: PostgresChangesOptions) {
	return Layer.effectContext(
		Effect.gen(function* () {
			yield* listenForChanges(options).pipe(
				Effect.provideService(SqlClient.SqlClient, options.client),
				Effect.provideService(PostgresChangeListener, options.listenerClient ?? options.client),
				Effect.provideService(PostgresChangeResync, { resync: options.resync }),
				Effect.provideService(PostgresChangeSync, { synced: options.synced }),
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
				const trailing = yield* TrailingNotification;
				if (trailing !== undefined) {
					yield* sql`select pg_notify(${options.channel}, ${trailing})`;
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
			// An enclosing transaction sends the keys at its own commit, so the token waits for that commit.
			function sendToken(token: string, enclosed: boolean) {
				const send = Effect.asVoid(options.client`select pg_notify(${options.channel}, ${token})`);
				return enclosed
					? options.client.afterCommit(Effect.catchCause(send, (cause) => Effect.logError("PostgreSQL sync token failed after its commit", cause)))
					: send;
			}
			const publish = Effect.fn("PostgresChanges.publish")(function* (keys: readonly unknown[], sync?: SyncToken) {
				const token = sync === undefined ? undefined : encodeSync({ sync });
				const enclosed = Option.isSome(yield* Effect.serviceOption(options.client.transactionService));
				const riding = keys.length > 0 && !enclosed ? token : undefined;
				if (keys.length > 0) {
					yield* invalidateOnCommit(keys).pipe(transact(), Effect.provideService(TrailingNotification, riding));
				}
				if (token !== undefined && riding === undefined) {
					yield* sendToken(token, enclosed);
				}
			});
			const publication: CommandPublisher = {
				publish: (keys, sync) =>
					publish(keys, sync).pipe(
						Effect.provideService(SqlClient.SqlClient, options.client),
						Effect.catchCause((cause) => Effect.fail(new CommandPublicationError({ cause }))),
					),
				recover,
			};
			return Context.make(BeforeCommit, notify).pipe(Context.add(CommittedSink, committed), Context.add(CommandPublication, publication));
		}),
	);
}
