import { Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";
import { appModules } from "#appModules.ts";
import { TestRoles } from "#test/permissions.ts";
import { Api, notesModule, TitleSource, tasksModule } from "./features.ts";

interface State {
	readonly calls: string[];
	replacements: Layer.Layer<TitleSource> | Layer.Layer<never>;
	url: string;
}

const sessions = Layer.succeed(SessionPolicy, {
	origin: () => true,
	provider: {
		get: (headers) =>
			Effect.succeed(
				headers.authorization === "admin"
					? Option.some({ user: { email: "admin@example.test", id: "admin", name: "Admin", role: "admin" } })
					: Option.none(),
			),
	},
	roles: TestRoles,
});

export const modulesHost = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (state: State) {
			const database = yield* PostgresTestDatabase;
			const modules = appModules([notesModule, tasksModule], { replacements: state.replacements });
			const services = yield* Layer.build(
				appHost({
					...modules,
					config: { databaseUrl: database.url, port: 0 },
					sessions,
				}),
			);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(services));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected TCP address");
			}
			state.url = `http://127.0.0.1:${server.address.port}/rpc`;
		}),
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): State => ({ calls: [], replacements: Layer.empty, url: "" }),
	layer: postgres,
	name: "application modules",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (state, story) => ({
		read: (operation: "notes.read" | "tasks.read" | "admin.notes.read" | "admin.tasks.read", caller?: "admin") => {
			story.tell(`${caller ?? "a visitor"} calls ${operation} over HTTP`);
			const protocol = RpcClient.layerProtocolHttp({
				transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", caller ?? "")),
				url: state.url,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
			return answered(
				Effect.flatMap(RpcClient.make(Api, { flatten: true }), (client) => client(operation, undefined)).pipe(Effect.provide(protocol)),
			);
		},
		replacementCalls: () => Effect.sync(() => [...state.calls]),
	}),
});

export const replacedSource = modulesHost.trait("configured", "the application replaces the modules' title source", (state) => {
	state.replacements = Layer.succeed(TitleSource, (title) =>
		Effect.sync(() => {
			state.calls.push(title);
			return `Replaced: ${title}`;
		}),
	);
});
