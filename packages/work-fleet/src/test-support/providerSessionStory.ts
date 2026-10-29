import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resolveHost } from "#host/config.ts";
import { hostProvider } from "#host/providers.ts";
import type { CodexCloudConfiguration } from "#providers/codexCloud.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { codexConfiguration, codexServer, WireRejection, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudThread, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { receipt } from "#test/session.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

interface State {
	cloud: boolean;
	logs: ReturnType<typeof captureLogs>;
	metadata: boolean;
	nameFailure: "rejected" | "timeout" | undefined;
	options: Partial<CodexCloudConfiguration>;
	persisted: string[];
	reply: (request: WireRequest) => unknown;
	requests: WireRequest[];
	sessions: typeof SessionService.Service | undefined;
}
function metadataReply(state: State, request: WireRequest): unknown {
	switch (request.method) {
		case "thread/start":
			return { thread: { id: receipt.sessionId } };
		case "thread/read":
			return cloudThread();
		case "turn/start":
			return { turn: { id: receipt.turnId } };
		case "thread/name/set":
			state.persisted.push("name requested");
			if (state.nameFailure === "timeout") {
				return undefined;
			}
			if (state.nameFailure === "rejected") {
				return new WireRejection("Name rejected");
			}
			return {};
		default:
			return state.reply(request);
	}
}
export const providerSessionOptions = {
	after: {
		*configuration(state: State) {
			const fixture = yield* codexServer((request) => {
				state.requests.push(request);
				if (request.method === "initialized") {
					return undefined;
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
			const journal = Layer.succeed(SessionJournal)({
				acknowledgeSession: (_operation, sessionId) =>
					Effect.sync(() => {
						state.persisted.push(sessionId);
					}),
				acknowledgeTurn: () => Effect.void,
				...(state.metadata ? { sessionName: () => Effect.succeed("synthetic-work: Synthetic work") } : {}),
			});
			state.sessions = Context.get(
				yield* Layer.build(SessionService.layer.pipe(Layer.provide([transport, journal]))).pipe(Effect.provide(state.logs.layer)),
				SessionService,
			);
		},
	},
	clock: "live" as const,
	create: (): State => ({
		cloud: false,
		logs: captureLogs(),
		metadata: false,
		nameFailure: undefined,
		options: {},
		persisted: [],
		reply: () => ({}),
		requests: [],
		sessions: undefined,
	}),
	inspect: (state: State) => ({ persisted: state.persisted, requests: state.requests }),
	layer: NodeServices.layer,
	name: "Codex journaled sessions",
	stages: ["configuration"] as const,
	verbs: (state: State, story: { tell: (line: string) => void }) => {
		const sessions = state.sessions;
		if (sessions === undefined) {
			throw new Error("The journaled provider did not start");
		}
		return {
			logs: () => state.logs.entries,
			persisted: () => state.persisted,
			replyWith: (reply: (request: WireRequest) => unknown) =>
				Effect.sync(() => {
					story.tell("the fake provider responds to journaled sessions");
					state.reply = reply;
				}),
			requests: () => state.requests,
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
