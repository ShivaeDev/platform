import { Deferred, Effect, Layer, ManagedRuntime, Queue, type Redacted, SubscriptionRef } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appHost } from "@shivaedev/server/appDatabase.ts";
import { Api, migrations, ReadControl, repository } from "./feature.ts";

export const openHost = Effect.fnUntraced(function* (databaseUrl: Redacted.Redacted<string>) {
	const reads = yield* SubscriptionRef.make(0);
	const notifications = yield* Queue.unbounded<void>();
	const entered = yield* Deferred.make<void>();
	const released = yield* Deferred.make<void>();
	const control = { allowed: true, policy: Effect.void, read: Effect.void };
	const hold = Effect.andThen(Deferred.succeed(entered, undefined), Deferred.await(released));
	const awaitRead = Effect.suspend(() => {
		const pending = control.read;
		control.read = Effect.void;
		return pending;
	});
	const handlers = Api.application.toLayer(
		Effect.gen(function* () {
			const rows = yield* repository;
			const reactivity = yield* Reactivity.Reactivity;
			yield* Effect.acquireRelease(
				Effect.sync(() =>
					reactivity.registerUnsafe(["compared_notes"], () => {
						// Wait for this notification's callbacks and hint flush before the next commit.
						queueMicrotask(() => Queue.offerUnsafe(notifications, undefined));
					}),
				),
				(cancel) => Effect.sync(cancel),
			);
			return Api.application.of({
				"compared.independent": () =>
					rows.findMany({ orderBy: { direction: "asc", field: "id" }, where: { owner: "alice", title: { like: "Visible%" } } }).pipe(Effect.orDie),
				"compared.list": () =>
					rows.findMany({ orderBy: { direction: "asc", field: "id" }, where: { owner: "alice", title: { like: "Visible%" } } }).pipe(
						Effect.tap(() => SubscriptionRef.update(reads, (count) => count + 1)),
						Effect.tap(() => awaitRead),
						Effect.orDie,
					),
				"compared.rename": (input) => rows.update({ ...input, owner: "alice" }).pipe(Effect.asVoid, Effect.orDie),
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
					services: Layer.succeed(ReadControl, control),
				}),
			),
		),
		(value) => Effect.promise(() => value.dispose()),
	);
	const server = yield* Effect.promise(() => runtime.runPromise(HttpServer.HttpServer));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die(new Error("Expected a TCP host"));
	}
	return { control, entered, hold, notifications, reads, released, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
