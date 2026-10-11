import { Context, Effect, Layer, Schema } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { codexCloudConnection } from "#providers/codexCloudConnection.ts";
import { decode, failure } from "#providers/codexRpc.ts";
import type { ContinueSession, StartSession } from "#session/schema.ts";
import { SessionTransport } from "#session/service.ts";

export const CODEX_CLOUD_ENDPOINT = "wss://codex-cloud-backend.chatgpt.com/";
export const CodexCloudConfiguration = Schema.Struct({
	archiveThreads: Schema.optional(Schema.Boolean),
	authFile: Schema.optional(Schema.String),
	cwd: Schema.String.check(Schema.isNonEmpty()),
	endpoint: Schema.optional(Schema.String),
	environmentId: Schema.String.check(Schema.isNonEmpty()),
	projectId: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
	refreshCommand: Schema.optional(Schema.Struct({ args: Schema.Array(Schema.String), command: Schema.String })),
	requestTimeoutMs: Schema.Finite.check(Schema.isGreaterThan(0)),
	threadNamePrefix: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
	writableRoots: Schema.optional(Schema.Array(Schema.String)),
});
export type CodexCloudConfiguration = typeof CodexCloudConfiguration.Type;
export class CodexCloudConfig extends Context.Service<CodexCloudConfig, CodexCloudConfiguration>()("@shivaedev/work-fleet/CodexCloudConfig") {}

const CloudThread = Schema.Struct({
	thread: Schema.Struct({
		environments: Schema.NullOr(
			Schema.Array(
				Schema.Struct({ cwd: Schema.String, environmentConfigId: Schema.optional(Schema.String), environmentId: Schema.optional(Schema.String) }),
			),
		),
	}),
});
function threadStart(config: CodexCloudConfiguration, input: StartSession) {
	return {
		config: {
			"sandbox_mode": input.access === "read-only" ? "read-only" : "workspace-write",
			...(input.access === "read-only" ? { "approval_policy": "never" } : {}),
			...(input.settings?.effort === undefined ? {} : { "model_reasoning_effort": input.settings.effort }),
		},
		deferredEnvironment: true,
		environments: [{ cwd: config.cwd, environmentConfigId: config.environmentId }],
		experimentalRawEvents: false,
		pluginsMcp: { productSku: "codex" },
		serviceName: "codex_cloud",
		threadSource: "user",
		...(config.projectId === undefined ? {} : { projectId: config.projectId }),
		...(input.settings?.model === undefined ? {} : { model: input.settings.model }),
		...(input.settings?.serviceTier === undefined ? {} : { serviceTier: input.settings.serviceTier }),
	};
}

export const codexCloudLayer = Layer.effect(SessionTransport)(
	Effect.gen(function* () {
		const config = yield* Schema.decodeUnknownEffect(CodexCloudConfiguration)(yield* CodexCloudConfig).pipe(
			Effect.mapError(() => failure("unavailable", "Codex Cloud configuration needs an environment, workspace cwd and positive timeout")),
		);
		const rpc = yield* codexCloudConnection(config.endpoint ?? CODEX_CLOUD_ENDPOINT, config, config.requestTimeoutMs);
		const sandboxPolicy = {
			excludeSlashTmp: false,
			excludeTmpdirEnvVar: false,
			networkAccess: true,
			type: "workspaceWrite",
			writableRoots: config.writableRoots ?? [config.cwd, "/tmp"],
		};
		const verifyEnvironment = Effect.fn("CodexCloud.verifyEnvironment")(function* (input: ContinueSession) {
			const read = yield* rpc("thread/read", { includeTurns: false, threadId: input.sessionId }).pipe(
				Effect.flatMap((value) => decode(CloudThread, value)),
			);
			const environments = read.thread.environments ?? [];
			const [environment] = environments;
			if (
				environments.length !== 1
				|| environment === undefined
				|| (environment.environmentConfigId ?? environment.environmentId) !== config.environmentId
				|| environment.cwd !== config.cwd
			) {
				return yield* Effect.fail(failure("protocol", "Codex Cloud did not confirm the configured environment and cwd; retain the session"));
			}
			return input.access === "read-only"
				? { approvalPolicy: "never", sandboxPolicy: { networkAccess: false, type: "readOnly" } }
				: { approvalPolicy: "on-request", approvalsReviewer: "auto_review", sandboxPolicy };
		});
		const adapter = codexAdapter(rpc, {
			beforeTurn: verifyEnvironment,
			provisioning: "unknown",
			threadStart: (input) => threadStart(config, input),
		});
		return {
			...adapter,
			archive: (sessionId: string) =>
				config.archiveThreads === false ? Effect.void : rpc("thread/archive", { threadId: sessionId }, true).pipe(Effect.asVoid),
			nameSession: (sessionId: string) =>
				rpc("thread/name/set", { name: `${config.threadNamePrefix ?? "Fleet: "}${sessionId}`, threadId: sessionId }, true).pipe(Effect.asVoid),
			startSession: (input: StartSession) =>
				input.cwd === config.cwd
					? adapter.startSession(input)
					: Effect.fail(failure("rejected", "Work cwd differs from the configured Codex Cloud workspace cwd")),
		};
	}),
);
