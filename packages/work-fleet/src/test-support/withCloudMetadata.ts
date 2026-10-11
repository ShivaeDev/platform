import { Effect, Layer } from "effect";
import { resolveHost } from "#host/config.ts";
import { hostProvider } from "#host/providers.ts";
import type { CodexCloudConfiguration } from "#providers/codexCloud.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { codexServer, WireRejection, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudThread, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { receipt } from "#test/session.ts";

export function withCloudMetadata<A, E>(
	options: Partial<CodexCloudConfiguration> & { readonly nameFailure?: "rejected" | "timeout" },
	use: (requests: readonly WireRequest[], persisted: readonly string[]) => Effect.Effect<A, E, typeof SessionService.Identifier>,
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const requests: WireRequest[] = [];
			const persisted: string[] = [];
			const fixture = yield* codexServer((request) => {
				requests.push(request);
				switch (request.method) {
					case "thread/start":
						return { thread: { id: receipt.sessionId } };
					case "thread/name/set":
						persisted.push("name requested");
						if (options.nameFailure === "timeout") {
							return undefined;
						}
						return options.nameFailure === "rejected" ? new WireRejection("Name rejected") : {};
					case "thread/read":
						return cloudThread();
					case "turn/start":
						return { turn: { id: receipt.turnId } };
					default:
						return {};
				}
			});
			const authFile = yield* authFolder(syntheticToken("metadata", FUTURE_EXPIRY));
			const provider = hostProvider(
				resolveHost("/synthetic-board", {
					cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: fixture.endpoint, environmentId: SYNTHETIC_ENVIRONMENT, ...options },
					provider: "cloud",
				}),
			);
			const journal = Layer.succeed(SessionJournal)({
				acknowledgeSession: (_operationId, sessionId) =>
					Effect.sync(() => {
						persisted.push(sessionId);
					}),
				acknowledgeTurn: () => Effect.void,
			});
			return yield* use(requests, persisted).pipe(Effect.provide(SessionService.layer.pipe(Layer.provide([provider, journal]))));
		}),
	);
}
