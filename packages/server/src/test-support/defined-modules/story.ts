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
import { Api, draftsModule, handWrittenNotesModule, notesModule, replacedNotesModule } from "#test/defined-modules/features.ts";
import { TestRoles } from "#test/permissions.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

type Caller = "alice" | "a visitor";

interface State {
	notes: typeof notesModule | typeof handWrittenNotesModule | typeof replacedNotesModule;
	startup: string;
	url: string;
}

const sessions = Layer.succeed(SessionPolicy, {
	origin: () => true,
	provider: {
		get: (headers) =>
			Effect.succeed(
				headers.authorization === "alice"
					? Option.some({ user: { email: "alice@example.test", id: "alice", name: "Alice", role: "user" } })
					: Option.none(),
			),
	},
	roles: TestRoles,
});

export const definedModulesHost = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (state: State) {
			const database = yield* PostgresTestDatabase;
			const modules = yield* appModules([draftsModule, state.notes]);
			const host = appHost({ postgresSettings: {}, ...modules, config: { databaseUrl: database.url, port: 0 }, sessions });
			const started = yield* Layer.build(host).pipe(
				Effect.map(Option.some),
				Effect.catchTag("HandWrittenModuleHandlers", (refusal) =>
					Effect.sync(() => {
						state.startup = refusal.message;
						return Option.none();
					}),
				),
			);
			if (Option.isNone(started)) {
				return;
			}
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(started.value));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected TCP address");
			}
			state.startup = "started";
			state.url = `http://127.0.0.1:${server.address.port}/rpc`;
		}),
	},
	around: withIsolatedDatabase,
	clock: "test",
	create: (): State => ({ notes: notesModule, startup: "not built", url: "" }),
	layer: postgres,
	name: "defined modules",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (state, story) => {
		function client(caller: Caller) {
			return RpcClient.make(Api, { flatten: true }).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", caller === "alice" ? "alice" : "")),
						url: state.url,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
				),
			);
		}
		return {
			createNote: (title: string, caller: Caller = "alice") => {
				story.tell(`${caller} creates the note ${title} through notes.create`);
				return answered(Effect.flatMap(client(caller), (call) => call("notes.create", { title })));
			},
			readDraft: (title: string) => {
				story.tell(`a visitor reads the draft ${title} through drafts.read`);
				return answered(Effect.flatMap(client("a visitor"), (call) => call("drafts.read", { title })));
			},
			readNote: (id: number, caller: Caller = "alice") => {
				story.tell(`${caller} reads note ${id} through notes.get`);
				return answered(Effect.flatMap(client(caller), (call) => call("notes.get", { id })));
			},
			startup: () => Effect.sync(() => state.startup),
		};
	},
});

export const handWrittenNotes = definedModulesHost.trait(
	"configured",
	"the application serves the notes module through hand-written handlers",
	(state) => {
		state.notes = handWrittenNotesModule;
	},
);

export const replacedNotes = definedModulesHost.trait(
	"configured",
	"a test fake replaces the notes module's handlers through replacedModuleHandlers",
	(state) => {
		state.notes = replacedNotesModule;
	},
);
