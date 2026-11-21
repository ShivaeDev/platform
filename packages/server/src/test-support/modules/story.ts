import { Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import type { DuplicateModuleQueue } from "#DuplicateModuleQueue.ts";
import { Api, notesModule, TitleSource, tasksModule } from "#test/modules/features.ts";
import { TestRoles } from "#test/permissions.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

interface State {
	readonly calls: string[];
	refusal?: Pick<DuplicateModuleQueue, "firstAdminPage" | "firstModule" | "queue" | "secondAdminPage" | "secondModule">;
	replacements: Layer.Layer<TitleSource> | Layer.Layer<never>;
	sharedQueue: readonly { readonly name: string }[];
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
			const composed = yield* appModules(
				[
					{ ...notesModule, queues: state.sharedQueue },
					{ ...tasksModule, queues: state.sharedQueue },
				],
				{ replacements: state.replacements },
			).pipe(
				Effect.map(Option.some),
				Effect.catchTag("DuplicateModuleQueue", ({ firstAdminPage, firstModule, queue, secondAdminPage, secondModule }) =>
					Effect.sync(() => {
						state.refusal = { firstAdminPage, firstModule, queue, secondAdminPage, secondModule };
						return Option.none();
					}),
				),
			);
			if (Option.isNone(composed)) {
				return;
			}
			const modules = composed.value;
			const services = yield* Layer.build(
				appHost({
					postgresSettings: {},
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
	clock: "test",
	create: (): State => ({ calls: [], replacements: Layer.empty, sharedQueue: [], url: "" }),
	layer: postgres,
	name: "application modules",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (state, story) => ({
		queueRefusal: () => Effect.sync(() => state.refusal ?? "composition was not refused"),
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

export const queueSharedByNotesAndTasks = modulesHost.trait(
	"configured",
	"the notes and tasks registrations, each named and each with an admin page, both declare the queue titles.refresh",
	(state) => {
		state.sharedQueue = [{ name: "titles.refresh" }];
	},
);
