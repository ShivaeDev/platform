import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Logger } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";
import { followHints } from "#test/rpc/followHints.ts";
import { Api, handlers, migrations } from "./feature.ts";

const openHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const errors: string[] = [];
	const services = yield* Layer.build(
		appHost({
			config: { databaseUrl: database.url, port: 0 },
			group: Api,
			handlers,
			migrations,
			policy: "loopback",
		}).pipe(
			Layer.provide(
				Logger.layer([
					Logger.make((entry) => {
						if (entry.logLevel === "Error") {
							errors.push(String(entry.message));
						}
					}),
				]),
			),
		),
	);
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(services));
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP host");
	}
	const protocol = yield* Layer.build(
		RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(`ws://127.0.0.1:${address.port}/rpc`), RpcSerialization.layerNdjson])),
	);
	const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(protocol));
	const feed = yield* followHints(client("recovery.$changes", { queries: [{ payload: undefined, query: "list" }] }));
	return { client, errors, feed };
});

export const publicationRecoveryStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		return { local: yield* openHost, remote: yield* openHost };
	},
	layer: postgres,
	name: "publication recovery through two hosts",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (engine, story) => ({
		errors: () => engine.local.errors,
		initialHints: () => ({ local: engine.local.feed.hints, remote: engine.remote.feed.hints }),
		nextHint: (location: "local" | "remote") => engine[location].feed.next,
		read: (location: "local" | "remote") => engine[location].client("recovery.list", undefined),
		saveWithOversizedKey: (title: string) => {
			story.tell(`save ${title} with a declared key exceeding PostgreSQL's notification limit`);
			return engine.local.client("recovery.save", { key: "x".repeat(8000), title });
		},
	}),
});
