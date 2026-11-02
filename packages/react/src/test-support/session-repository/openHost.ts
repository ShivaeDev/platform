import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Effect, Layer, ManagedRuntime, Option, type Redacted } from "effect";
import { type Headers, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Identity } from "@shivaedev/identity/identity.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { Api, migrations, ReadAccess, repository } from "./feature.ts";

export const openHost = Effect.fnUntraced(function* (databaseUrl: Redacted.Redacted<string>) {
	const allowed = new Set(["alice", "bob"]);
	const reads: string[] = [];
	const sessions = new Map([
		["Bearer alice-session", "alice"],
		["Bearer bob-session", "bob"],
	]);
	function session(headers: Headers.Headers) {
		return Effect.succeed(Option.map(Option.fromUndefinedOr(sessions.get(headers.authorization ?? "")), (id) => ({ user: { id } })));
	}
	const read = Effect.fnUntraced(function* ({ id: noteId }: { readonly id: number }) {
		const rows = yield* repository;
		const { id } = yield* Identity;
		reads.push(id);
		const row = yield* rows.findById(noteId);
		return row.title;
	}, Effect.orDie);
	const host = yield* Effect.acquireRelease(
		Effect.sync(() =>
			ManagedRuntime.make(
				appHost({
					config: { databaseUrl, port: 0 },
					group: Api,
					handlers: Api.application.toLayer({ "sessionNotes.compared": read, "sessionNotes.get": read }),
					migrations: { ...migrations, mode: "check" },
					services: Layer.succeed(ReadAccess, { allowed }),
					sessions: Layer.succeed(SessionPolicy, {
						origin: () => true,
						provider: { get: session },
					}),
				}),
			),
		),
		(runtime) => Effect.promise(() => runtime.dispose()),
	);
	const worker = yield* Effect.acquireRelease(
		Effect.sync(() =>
			ManagedRuntime.make(
				appDatabase({ config: { databaseUrl }, migrations: { ...migrations, mode: "check" } }).pipe(Layer.provide(NodeCrypto.layer)),
			),
		),
		(runtime) => Effect.promise(() => runtime.dispose()),
	);
	const server = yield* Effect.promise(() => host.runPromise(HttpServer.HttpServer));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die(new Error("Expected a TCP host"));
	}
	return {
		allowed,
		reads,
		url: `http://127.0.0.1:${server.address.port}/rpc`,
		write: (title: string) =>
			Effect.promise(() => worker.runPromise(Effect.flatMap(repository, (rows) => rows.update({ id: 1, owner: "alice", title })))),
	};
});
