import { Cause, ConfigProvider, Effect, Layer, Logger, Option } from "effect";
import * as Base64 from "effect/encoding/Base64";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { COLUMN_KEY_CONFIG } from "@shivaedev/sql/ColumnKey.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import type { OtlpSpan } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import { Api, draftsModule, handWrittenNotesModule, notesModule, replacedNotesModule } from "#test/defined-modules/features.ts";
import { Greetings, greetingsModule } from "#test/defined-modules/greetings.ts";
import { Members, membersModule, privateJoinMembersModule } from "#test/defined-modules/members.ts";
import { OwnedData, ownedDataModule } from "#test/defined-modules/ownedData.ts";
import { ProviderTokensModule, providerTokensModule } from "#test/defined-modules/providerTokens.ts";
import { sessions } from "#test/defined-modules/sessions.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { spanAttribute } from "#test/spanAttribute.ts";
import { workerHost } from "#workerHost.ts";

type Caller = "alice" | "a visitor";

const draftsQueue = { name: "drafts.publish" };

interface State {
	collector?: { readonly untilSpan: (name: string) => Effect.Effect<OtlpSpan, unknown> };
	columnKey: string | undefined;
	drafts: typeof draftsModule | (typeof draftsModule & { readonly queues: readonly (typeof draftsQueue)[] });
	readonly env: Record<string, string>;
	greetings: typeof greetingsModule | (typeof greetingsModule & { readonly queues: readonly (typeof draftsQueue)[] });
	host: "app" | "application" | "worker";
	logs: { readonly cause: Cause.Cause<unknown>; readonly message: readonly unknown[] }[];
	members: typeof membersModule | typeof privateJoinMembersModule;
	notes: typeof notesModule | typeof handWrittenNotesModule | typeof replacedNotesModule;
	startup: string;
	url: string;
}

export const definedModulesHost = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (state: State) {
			const database = yield* PostgresTestDatabase;
			const composed = yield* appModules([state.drafts, state.notes, state.members, state.greetings, ownedDataModule, providerTokensModule]).pipe(
				Effect.map(Option.some),
				Effect.catchTag("DuplicateModuleQueue", (refusal) =>
					Effect.sync(() => {
						state.startup = refusal.message;
						return Option.none();
					}),
				),
			);
			if (Option.isNone(composed)) {
				return;
			}
			const modules = composed.value;
			const recorded = Logger.make(({ cause, message }) => {
				state.logs.push({ cause, message: Array.isArray(message) ? message : [message] });
			});
			const configured = Layer.mergeAll(
				Logger.layer([recorded]),
				ConfigProvider.layerAdd(
					ConfigProvider.fromUnknown({ ...state.env, ...(state.columnKey === undefined ? {} : { [COLUMN_KEY_CONFIG]: state.columnKey }) }),
					{ asPrimary: true },
				),
			);
			if (state.host === "worker") {
				const worker = workerHost({ postgresSettings: {}, ...modules, config: { databaseUrl: database.url }, services: modules.services });
				state.startup = yield* Layer.build(worker.pipe(Layer.provide(configured))).pipe(
					Effect.as("started"),
					Effect.catchTag("ColumnKeyError", (refusal) => Effect.succeed(refusal.message)),
				);
				return;
			}
			const config = { databaseUrl: database.url, port: 0 };
			// The application form, as the starter writes it: the application Effect builds the module services and hands the host the built context.
			function application() {
				const { group, handlers, requestServices } = modules;
				return Effect.map(Layer.build(modules.services), (built) => ({
					config,
					group,
					handlers,
					requestServices,
					services: Layer.succeedContext(built),
					sessions,
				}));
			}
			const host =
				state.host === "application"
					? Layer.build(
							appHost({ application: application(), config, migrations: modules.migrations, postgresSettings: {} }).pipe(Layer.provide(configured)),
						)
					: Layer.build(appHost({ postgresSettings: {}, ...modules, config, sessions }).pipe(Layer.provide(configured)));
			const started = yield* Effect.suspend(() => host).pipe(
				Effect.map(Option.some),
				Effect.catchTags({
					ColumnKeyError: (refusal) =>
						Effect.sync(() => {
							state.startup = refusal.message;
							return Option.none();
						}),
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
	// The provider tokens module's model has an encrypted field, so every host starts with a generated key unless a trait changes it.
	create: (): State => ({
		columnKey: Base64.encode(globalThis.crypto.getRandomValues(new Uint8Array(32))),
		drafts: draftsModule,
		env: {},
		greetings: greetingsModule,
		host: "app",
		logs: [],
		members: membersModule,
		notes: notesModule,
		startup: "not built",
		url: "",
	}),
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
		function greetingsClient() {
			return RpcClient.make(Greetings, { flatten: true }).pipe(
				Effect.provide(RpcClient.layerProtocolHttp({ url: state.url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))),
			);
		}
		function providerTokensClient() {
			return RpcClient.make(ProviderTokensModule, { flatten: true }).pipe(
				Effect.provide(RpcClient.layerProtocolHttp({ url: state.url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))),
			);
		}
		function ownedDataClient() {
			return RpcClient.make(OwnedData, { flatten: true }).pipe(
				Effect.provide(RpcClient.layerProtocolHttp({ url: state.url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))),
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
			exportedMemberSpan: () =>
				Effect.gen(function* () {
					if (state.collector === undefined) {
						return yield* Effect.die("Give the host a collector before reading its exported spans");
					}
					return spanAttribute(yield* state.collector.untilSpan("Members.show"), "member");
				}),
			greet: (name: string) => {
				story.tell(`alice greets ${name} through greetings.greet`);
				return answered(Effect.flatMap(greetingsClient(), (call) => call("greetings.greet", { name })));
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
			ownedModels: () => {
				story.tell("an operation served by the host reads the owned models its repositories reported");
				return answered(
					Effect.flatMap(ownedDataClient(), (call) =>
						Effect.map(call("ownedData.owned", {}), (owned) => [...owned].sort((left, right) => (left.table < right.table ? -1 : 1))),
					),
				);
			},
			readDraft: (title: string) => {
				story.tell(`a visitor reads the draft ${title} through drafts.read`);
				return answered(Effect.flatMap(client("a visitor"), (call) => call("drafts.read", { title })));
			},
			readNote: (id: number, caller: Caller = "alice") => {
				story.tell(`${caller} reads note ${id} through notes.get`);
				return answered(Effect.flatMap(client(caller), (call) => call("notes.get", { id })));
			},
			readProviderToken: (id: number) => {
				story.tell(`a visitor reads provider token ${id} back through providerTokens.reveal`);
				return answered(Effect.flatMap(providerTokensClient(), (call) => call("providerTokens.reveal", { id })));
			},
			showMember: (id: number) => {
				story.tell(`alice reads member ${id} through members.show, whose handler logs the member's row`);
				return answered(Effect.flatMap(membersClient(), (call) => call("members.show", { id })));
			},
			startup: () => Effect.sync(() => state.startup),
			storeProviderToken: (token: string) => {
				story.tell(`a visitor stores the provider token ${token} through providerTokens.store`);
				return answered(Effect.flatMap(providerTokensClient(), (call) => call("providerTokens.store", { token })));
			},
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

export const queueSharedWithGreetings = definedModulesHost.trait(
	"configured",
	"the drafts module and the greetings module both declare the queue drafts.publish",
	(state) => {
		state.drafts = { ...draftsModule, queues: [draftsQueue] };
		state.greetings = { ...greetingsModule, queues: [draftsQueue] };
	},
);

export function columnKey(configured: "missing" | "16 random bytes in base64") {
	return definedModulesHost.trait(
		"configured",
		`COLUMN_ENCRYPTION_KEY is ${configured === "missing" ? "not set" : `set to ${configured}`}`,
		(state) => {
			state.columnKey = configured === "missing" ? undefined : Base64.encode(globalThis.crypto.getRandomValues(new Uint8Array(16)));
		},
	);
}

export const servedByWorkerHost = definedModulesHost.trait("configured", "the modules are served by workerHost in place of appHost", (state) => {
	state.host = "worker";
});
