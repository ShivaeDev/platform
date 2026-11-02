import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resolveHost } from "#host/config.ts";
import { hostProvider } from "#host/providers.ts";
import type { CodexCloudConfiguration } from "#providers/codexCloud.ts";
import { SessionService } from "#session/service.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { codexConfiguration, codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { metadataReply, type ProviderSessionState } from "#test/providerSessionState.ts";
import { refuseAcknowledgement, sessionPersistence } from "#test/sessionPersistence.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";
import { scripted, type WireScript, wireLog } from "#test/wireScript.ts";

export const providerSessionOptions = {
	after: {
		*configuration(state: ProviderSessionState) {
			const persistence = yield* sessionPersistence;
			state.persistence = persistence;
			const fixture = yield* codexServer(async (request) => {
				state.requests.push(request);
				if (request.method === "initialized") {
					return undefined;
				}
				if (["thread/name/set", "turn/start"].includes(request.method)) {
					state.mutations.push({ attempts: await Effect.runPromise(persistence.read), method: request.method });
				}
				if (state.metadata) {
					return metadataReply(state, request);
				}
				return state.reply(request);
			});
			const authFile = yield* authFolder(syntheticToken("metadata", FUTURE_EXPIRY));
			const transport = state.cloud
				? hostProvider(
						resolveHost("/synthetic-board", {
							cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: fixture.endpoint, environmentId: SYNTHETIC_ENVIRONMENT, ...state.options },
							database: syntheticDatabase,
							provider: "cloud",
						}),
					)
				: codexConfiguration(fixture.endpoint);
			state.sessions = Context.get(
				yield* Layer.build(SessionService.layer.pipe(Layer.provide([transport, Layer.succeedContext(persistence.journal)]))).pipe(
					Effect.provide(state.logs.layer),
				),
				SessionService,
			);
		},
	},
	around: withIsolatedDatabase,
	clock: "live" as const,
	create: (): ProviderSessionState => ({
		cloud: false,
		logs: captureLogs(),
		metadata: false,
		mutations: [],
		nameFailure: undefined,
		options: {},
		persistence: undefined,
		reply: () => ({}),
		requests: [],
		sessions: undefined,
	}),
	inspect: (state: ProviderSessionState) => ({ mutations: state.mutations, requests: state.requests }),
	layer: Layer.merge(NodeServices.layer, postgresLayer),
	name: "Codex journaled sessions",
	runIf: postgresEnabled,
	stages: ["configuration"] as const,
	verbs: (state: ProviderSessionState, story: { tell: (line: string) => void }) => {
		const sessions = state.sessions;
		const persistence = state.persistence;
		if (sessions === undefined || persistence === undefined) {
			throw new Error("The journaled provider did not start");
		}
		return {
			...wireLog(() => state.requests),
			answers: (script: WireScript) =>
				Effect.sync(() => {
					story.tell(`the fake provider answers ${Object.keys(script).join(", ")}`);
					state.reply = scripted(script);
				}),
			journal: () => {
				story.tell("reopen the PostgreSQL repository and journal on a new connection");
				return persistence.read;
			},
			mutations: () => Effect.sync(() => [...state.mutations]),
			refuseAcknowledgement: (field: "sessionId" | "receipt__turnId") => {
				story.tell(`PostgreSQL refuses acknowledgements with ${field}`);
				return refuseAcknowledgement(field);
			},
			replyWith: (reply: (request: WireRequest) => unknown) =>
				Effect.sync(() => {
					story.tell("the fake provider responds to journaled sessions");
					state.reply = reply;
				}),
			reserveContinuation: () => {
				story.tell("persist the next turn's submission intent");
				return persistence.reserveContinuation;
			},
			sessions: {
				...sessions,
				archive: (...args: Parameters<typeof sessions.archive>) => {
					story.tell("archive a journaled provider session");
					return sessions.archive(...args);
				},
				start: (...args: Parameters<typeof sessions.start>) => {
					story.tell("start a journaled provider session");
					return sessions.start(...args).pipe(Effect.provide(state.logs.layer));
				},
			},
			warnings: () =>
				Effect.sync(() =>
					state.logs.entries.flatMap((entry) =>
						entry.level === "Warn" ? [{ annotations: entry.annotations, cause: entry.cause, message: entry.message }] : [],
					),
				),
		};
	},
};
export const providerSessions = storyKit(providerSessionOptions);
export function sessionProvider(cloud: boolean) {
	return providerSessions.trait("configuration", `the session uses ${cloud ? "Cloud" : "local Codex"}`, (state) => {
		state.cloud = cloud;
	});
}
export function cloudMetadata(options: Partial<CodexCloudConfiguration> & { nameFailure?: "rejected" | "timeout" }) {
	return providerSessions.trait("configuration", "the host manages Cloud thread metadata", (state) => {
		state.cloud = true;
		state.metadata = true;
		state.options = options;
		state.nameFailure = options.nameFailure;
	});
}
