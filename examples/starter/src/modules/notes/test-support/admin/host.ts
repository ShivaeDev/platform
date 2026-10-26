import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Admin } from "#modules/notes/admin.ts";
import { notesHttp } from "#modules/notes/test-support/http.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { developmentServer } from "#test-support/developmentServer.ts";
import { startHost } from "#test-support/host.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

export const adminHost = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const host = yield* startHost();
		const cookies = new Map<string, string>();
		return { cookies, host, url: host.baseUrl };
	},
	inspect: ({ host }) => ({ baseUrl: host.baseUrl }),
	layer: postgres,
	name: "admin host",
	stages: ["accounts"],
	verbs: (engine, story) => ({
		createNote: Effect.fn("AdminStory.createNote")(function* (name: string, title: string) {
			story.tell(`${name} creates a note`);
			const client = yield* notesHttp(engine.host.baseUrl, engine.cookies.get(name), engine.host.origin);
			return yield* client["notes.create"]({ title });
		}),
		openAdmin: Effect.fn("AdminStory.openAdmin")(function* (name = "visitor") {
			story.tell(`${name} opens the admin RPC`);
			const protocol = RpcClient.layerProtocolHttp({
				transformClient: (client) =>
					HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie: engine.cookies.get(name) ?? "", origin: engine.url })),
				url: `${engine.url}/rpc`,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
			return yield* RpcClient.make(Admin.group).pipe(Effect.provide(protocol));
		}),
		request: (path: string) => Effect.promise(() => fetch(new URL(path, engine.url)).then((response) => response.text())),
		startDevelopment: Effect.fn("AdminStory.startDevelopment")(function* () {
			story.tell("start the app's Vite development server");
			engine.url = (yield* developmentServer(engine.host.baseUrl)).url;
		}),
		startWorker: Effect.fn("AdminStory.startWorker")(function* () {
			story.tell("start the app's word-count worker");
			const database = yield* PostgresTestDatabase;
			yield* Layer.build(applicationWorker({ databaseUrl: database.url, poolSizes: testPoolSizes }));
		}),
	}),
});

export function adminAccount(name: string, role = "user") {
	return adminHost.trait("accounts", `${name} already has a ${role} session`, function* (engine) {
		const { headers } = yield* mintUser(engine.host, name, role);
		engine.cookies.set(name, headers.get("cookie") ?? "");
	});
}
