import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Cause, Deferred, Effect, Fiber, Layer, Option, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { answered, errorWords } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import { close, start } from "#test/app-host/lifecycle.ts";
import { databaseOf, emptyHost, type HostState } from "#test/app-host/state.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { browserVerbs, coachingVerbs } from "#test/subject/browser.ts";
import { coachingModule, coachingWithoutRule } from "#test/subject/coaching.ts";
import { Api, CannotActForAccount, type State, sessions, subjectHost } from "#test/subject/feature.ts";

function httpClient(url: string, actor?: string, subject?: string) {
	const headers = { ...(actor === undefined ? {} : { authorization: actor }), ...(subject === undefined ? {} : { "x-platform-subject": subject }) };
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(headers)),
		url: `${url}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.flatMap(Layer.build(protocol), (services) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)));
}

function socketClient(url: string, actor: string, subject: string) {
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([
			layerWebSocket(`${url.replace(/^http/u, "ws")}/rpc`, { headers: { authorization: actor, "x-platform-subject": subject } }),
			RpcSerialization.layerNdjson,
		]),
	);
	return Effect.flatMap(Layer.build(protocol), (services) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)));
}

export const subjectStory = storyKit({
	after: { configured: ({ state }: { readonly state: HostState & State }) => start(state) },
	clock: "test",
	*create() {
		const state: HostState & State = { ...emptyHost(), handled: [], revoked: new Set<string>(), sessions: true, titles: new Map<string, string>() };
		state.build = () => subjectHost(state);
		yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
		return { state, streams: new Map<string, Fiber.Fiber<void, unknown>>() };
	},
	name: "declared request subjects over HTTP and WebSocket",
	stages: ["configured"],
	verbs: ({ state, streams }, story) => ({
		...browserVerbs(state, story),
		follow: (actor: string, subject: string) =>
			Effect.gen(function* () {
				story.tell(`${actor} opens a stream for ${subject}`);
				const rpc = yield* socketClient(state.url, actor, subject);
				const opened = yield* Deferred.make<string>();
				const fiber = yield* rpc("delegated.follow", undefined).pipe(
					Stream.runForEach((id) => Deferred.succeed(opened, id)),
					Effect.forkScoped,
				);
				streams.set(actor, fiber);
				return yield* Deferred.await(opened);
			}),
		handledRequests: () => Effect.sync(() => [...state.handled]),
		read: (boundary: "own" | "delegated", actor: string, subject?: string) => {
			story.tell(`${actor} reads ${subject ?? "their own account"} through ${boundary}`);
			return answered(Effect.flatMap(httpClient(state.url, actor, subject), (client) => client(`${boundary}.read`, undefined)));
		},
		rename: (boundary: "own" | "delegated" | "shared", actor: string | undefined, title: string, subject?: string) => {
			story.tell(`${actor ?? "a visitor"} renames ${subject ?? "their own account"} through ${boundary}`);

			return answered(
				Effect.flatMap(httpClient(state.url, actor, subject), (client) =>
					client(boundary === "shared" ? "own.renameFor" : `${boundary}.rename`, { title }),
				).pipe(Effect.catchTag("CannotActForAccount", ({ account }) => Effect.succeed({ refused: account }))),
			);
		},

		requestChanges: (actor: string, subject: string) => {
			story.tell(`${actor} requests changes for ${subject}`);
			return answered(
				Effect.flatMap(socketClient(state.url, actor, subject), (rpc) => Stream.runHead(rpc("delegated.$changes", { queries: [] }))).pipe(
					Effect.catchTag("CannotActForAccount", ({ account }) => Effect.succeed({ refused: account })),
				),
			);
		},
		revalidationIntervalPasses: (actor: string) => {
			story.tell("the session revalidation interval passes");
			const fiber = streams.get(actor);
			if (fiber === undefined) {
				return Effect.die("Open the stream first");
			}
			return untilTimer("30 seconds").pipe(
				Effect.andThen(
					passes(
						"30 seconds",
						answered(Fiber.join(fiber), (error) => (error instanceof CannotActForAccount ? `cannot act for ${error.account}` : String(error))),
					),
				),
			);
		},
		revokeDelegation: (actor: string) => {
			story.tell(`${actor} loses the right to act for other accounts`);
			return Effect.sync(() => state.revoked.add(actor));
		},
		storedTitles: () => Effect.sync(() => Object.fromEntries(state.titles)),
	}),
});

export function titled(account: string, title: string) {
	return subjectStory.trait("configured", `${account}'s account is titled ${title}`, ({ state }) => {
		state.titles.set(account, title);
	});
}

export const withoutSessions = subjectStory.trait("configured", "the host has no session policy", ({ state }) => {
	state.sessions = false;
});

interface CoachingState extends HostState {
	coaching: typeof coachingModule | typeof coachingWithoutRule;
	readonly revoked: Set<string>;
}

function coachingHost(state: CoachingState) {
	return Layer.unwrap(
		Effect.map(appModules([state.coaching]), (modules) =>
			appHost({
				postgresSettings: {},
				...modules,
				config: { databaseUrl: databaseOf(state).url, port: 0 },
				sessions: Layer.succeed(SessionPolicy, sessions(state)),
			}),
		),
	);
}

// The coaching application's delegation, on the real host and PostgreSQL, through the same browser-like client.
export const coachingStory = storyKit({
	after: { configured: (state: CoachingState) => start(state) },
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		const state: CoachingState = { ...emptyHost(), coaching: coachingModule, database: yield* PostgresTestDatabase, revoked: new Set<string>() };
		state.build = () => coachingHost(state);
		yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
		return state;
	},
	layer: postgres,
	name: "a module's delegated subject over WebSocket on PostgreSQL",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "running"],
	verbs: (state, story) => ({
		...coachingVerbs(state, story),
		startup: () =>
			Effect.sync(() =>
				state.bootFailure === undefined
					? "started"
					: Option.match(Cause.findErrorOption(state.bootFailure), {
							onNone: () => Cause.pretty(state.bootFailure ?? Cause.empty),
							onSome: (error) => (error instanceof Error ? error.message : errorWords(error)),
						}),
			),
		storedNote: (client: string) =>
			SqlClient.SqlClient.use((sql) => sql<{ note: string }>`select note from coaching_notes where client = ${client}`).pipe(
				Effect.map(([row]) => row?.note ?? "no stored note"),
			),
		unassigned: (coach: string, client: string) => {
			story.tell(`the coaching app ends ${coach}'s assignment to ${client}`);
			return SqlClient.SqlClient.use((sql) => sql`delete from coaching_assignments where coach = ${coach} and client = ${client}`);
		},
	}),
});

export function assigned(coach: string, client: string) {
	return coachingStory.trait("running", `${coach} is assigned as ${client}'s coach`, () =>
		SqlClient.SqlClient.use((sql) => sql`insert into coaching_assignments (coach, client) values (${coach}, ${client})`),
	);
}

export function noted(client: string, note: string, diary = "") {
	return coachingStory.trait("running", `${client}'s stored note reads "${note}"${diary === "" ? "" : ` and her diary "${diary}"`}`, () =>
		SqlClient.SqlClient.use((sql) => sql`insert into coaching_notes (client, note, diary) values (${client}, ${note}, ${diary})`),
	);
}

export const ruleForgotten = coachingStory.trait(
	"configured",
	"the application registers the coaching module without its delegation rule",
	(state) => {
		state.coaching = coachingWithoutRule;
		state.expectBootFailure = true;
	},
);
