import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Layer } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Admin, UsersPage } from "#modules/notes/admin.ts";
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
			return yield* makeClient(UsersPage.contract, {
				group: Admin.group,
				headers: { cookie: engine.cookies.get(name) ?? "", origin: engine.url },
				url: `${engine.url}/rpc`,
				webSocketConstructor: layerWebSocketConstructorWS,
			}).client;
		}),
		postAuthAdmin: (name: string, operation: string, body: object) =>
			Effect.promise(async () => {
				story.tell(`${name} calls the Better Auth ${operation} endpoint`);
				const response = await fetch(`${engine.host.baseUrl}/api/auth/admin/${operation}`, {
					body: JSON.stringify(body),
					headers: { "content-type": "application/json", cookie: engine.cookies.get(name) ?? "", origin: engine.host.origin },
					method: "POST",
				});
				await response.text();
				return { status: response.status };
			}),
		request: (path: string) => Effect.promise(() => fetch(new URL(path, engine.url)).then((response) => response.text())),
		roleChangeLogs: () => engine.host.logs.filter(({ message }) => Array.isArray(message) && message.includes("User role changed")),
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
