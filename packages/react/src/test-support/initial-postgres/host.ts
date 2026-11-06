import { Deferred, Effect, ManagedRuntime, Queue, type Redacted, Schema, SubscriptionRef } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { appHost } from "@shivaedev/server/appDatabase.ts";
import { migrations, notes, repository } from "#test/compared-postgres/feature.ts";

export const Api = contract("opening", {
	commands: [command("rename", { invalidates: () => [], payload: { title: Schema.String } })],
	queries: [
		query("read", {
			payload: { allowed: Schema.Boolean },
			readPolicy: ({ allowed }) => Effect.succeed(allowed),
			reads: () => [notes.item(1)],
			success: Schema.Struct({ revision: Schema.BigIntFromString, title: Schema.String }),
		}),
	],
});

export const openHost = Effect.fnUntraced(function* (databaseUrl: Redacted.Redacted<string>) {
	const reads = yield* SubscriptionRef.make(0);
	const notifications = yield* Queue.unbounded<void>();
	const entered = yield* Deferred.make<void>();
	const released = yield* Deferred.make<void>();
	const held = { after: false, before: false };
	const handlers = Api.application.toLayer(
		Effect.gen(function* () {
			const rows = yield* repository;
			const reactivity = yield* Reactivity.Reactivity;
			yield* Effect.acquireRelease(
				Effect.sync(() =>
					reactivity.registerUnsafe(["compared_notes"], () => {
						queueMicrotask(() => Queue.offerUnsafe(notifications, undefined));
					}),
				),
				(stop) => Effect.sync(stop),
			);
			return Api.application.of({
				"opening.read": () =>
					Effect.gen(function* () {
						yield* SubscriptionRef.update(reads, (count) => count + 1);
						if (held.before) {
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(released);
						}
						const row = yield* rows.findById(1).pipe(Effect.orDie);
						if (held.after) {
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(released);
						}
						return { revision: 1n, title: row.title };
					}),
				"opening.rename": ({ title }) => rows.update({ id: 1, owner: "alice", title }).pipe(Effect.asVoid, Effect.orDie),
			});
		}),
	);
	const runtime = yield* Effect.acquireRelease(
		Effect.sync(() =>
			ManagedRuntime.make(
				appHost({
					config: { databaseUrl, port: 0 },
					group: Api,
					handlers,
					migrations: { ...migrations, mode: "check" },
					policy: "loopback",
					postgresSettings: {},
				}),
			),
		),
		(value) => Effect.promise(() => value.dispose()),
	);
	const server = yield* Effect.promise(() => runtime.runPromise(HttpServer.HttpServer));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	return { entered, held, notifications, reads, released, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
