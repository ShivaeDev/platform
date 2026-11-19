import { Cause, Effect, Layer, Logger, Option } from "effect";
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
import { Members, membersModule, privateJoinMembersModule } from "#test/defined-modules/members.ts";
import { TestRoles } from "#test/permissions.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

type Caller = "alice" | "a visitor";

interface State {
	logs: { readonly cause: Cause.Cause<unknown>; readonly message: readonly unknown[] }[];
	members: typeof membersModule | typeof privateJoinMembersModule;
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
			const modules = yield* appModules([draftsModule, state.notes, state.members]);
			const host = appHost({ postgresSettings: {}, ...modules, config: { databaseUrl: database.url, port: 0 }, sessions });
			const recorded = Logger.make(({ cause, message }) => {
				state.logs.push({ cause, message: Array.isArray(message) ? message : [message] });
			});
			const started = yield* Layer.build(host.pipe(Layer.provide(Logger.layer([recorded])))).pipe(
				Effect.map(Option.some),
				Effect.catchTags({
					HandWrittenModuleHandlers: (refusal) =>
						Effect.sync(() => {
							state.startup = refusal.message;
							return Option.none();
						}),
					SensitiveFieldConflict: (refusal) =>
						Effect.sync(() => {
							state.startup = refusal.message;
							return Option.none();
						}),
				}),
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
	create: (): State => ({ logs: [], members: membersModule, notes: notesModule, startup: "not built", url: "" }),
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
		function membersClient() {
			return RpcClient.make(Members, { flatten: true }).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", "alice")),
						url: state.url,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
				),
			);
		}
		return {
			auditMember: (id: number) => {
				story.tell(`alice audits member ${id} through members.audit, whose handler dies holding the member's row`);
				return answered(Effect.flatMap(membersClient(), (call) => call("members.audit", { id })));
			},
			createNote: (title: string, caller: Caller = "alice") => {
				story.tell(`${caller} creates the note ${title} through notes.create`);
				return answered(Effect.flatMap(client(caller), (call) => call("notes.create", { title })));
			},
			joinMember: (name: string, address: string) => {
				story.tell(`alice adds the member ${name} living at ${address} through members.join`);
				return answered(Effect.flatMap(membersClient(), (call) => call("members.join", { address, name })));
			},
			loggedDefect: () =>
				Effect.sync(
					() =>
						state.logs.flatMap(({ cause, message }) => (message[0] === "RPC defect" ? cause.reasons.filter(Cause.isDieReason) : []))[0]?.defect
						?? "no RPC defect was logged",
				),
			loggedMember: () =>
				Effect.sync(() => state.logs.find(({ message }) => message[0] === "member shown")?.message[1] ?? "no log mentions a shown member"),
			readDraft: (title: string) => {
				story.tell(`a visitor reads the draft ${title} through drafts.read`);
				return answered(Effect.flatMap(client("a visitor"), (call) => call("drafts.read", { title })));
			},
			readNote: (id: number, caller: Caller = "alice") => {
				story.tell(`${caller} reads note ${id} through notes.get`);
				return answered(Effect.flatMap(client(caller), (call) => call("notes.get", { id })));
			},
			showMember: (id: number) => {
				story.tell(`alice reads member ${id} through members.show, whose handler logs the member's row`);
				return answered(Effect.flatMap(membersClient(), (call) => call("members.show", { id })));
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

export const privateJoinPayload = definedModulesHost.trait(
	"configured",
	"the members module's join payload marks address sensitive while its generated success names address too",
	(state) => {
		state.members = privateJoinMembersModule;
	},
);
