import { Effect, type FileSystem, type Path, Schema } from "effect";
import { decode } from "./codexProtocol.ts";
import type { CodexRpc } from "./codexRpc.ts";
import { type AgentRequest, failure } from "./ports.ts";

const Config = Schema.Struct({
	config: Schema.Struct({
		mcpServers: Schema.optional(Schema.Record(Schema.String, Schema.Struct({ enabled: Schema.optional(Schema.Boolean) }))),
	}).pipe(Schema.encodeKeys({ mcpServers: "mcp_servers" })),
});
export function codexConfiguration(request: AgentRequest, checkout: string, metadata: string) {
	const filesystem =
		request.attempt.role === "reviewer"
			? { ":root": "read" }
			: {
					":root": "read",
					[checkout]: "write",
					[metadata]: "write",
					[`${checkout}/.codex`]: "read",
					[`${checkout}/.agents`]: "read",
				};
	return {
		approvalPolicy: "never",
		config: {
			"default_permissions": "work-fleet",
			"features.multi_agent": false,
			permissions: { "work-fleet": { filesystem, network: { enabled: false } } },
			"shell_environment_policy.set": { "TEMP": metadata, "TMP": metadata, "TMPDIR": metadata },
			"web_search": "disabled",
		},
		cwd: checkout,
		modelProvider: "openai",
	};
}
export function prepareCodex(request: AgentRequest, call: typeof CodexRpc.Service.call, fs: FileSystem.FileSystem, path: Path.Path) {
	return Effect.gen(function* () {
		const checkout = yield* fs.realPath(request.work.checkout).pipe(Effect.mapError(() => failure("Codex checkout is unavailable")));
		const metadata = path.join(checkout, ".git");
		const info = yield* fs.stat(metadata).pipe(Effect.mapError(() => failure("Codex requires a dedicated standalone clone")));
		const actualMetadata = yield* fs.realPath(metadata).pipe(Effect.mapError(() => failure("Codex repository metadata is unavailable")));
		if (info.type !== "Directory" || actualMetadata !== metadata) {
			return yield* Effect.fail(failure("Codex requires a dedicated standalone clone; shared git worktrees and metadata symlinks are unsupported"));
		}
		const config = yield* call("config/read", { cwd: checkout, includeLayers: false }).pipe(Effect.flatMap((value) => decode(Config, value)));
		if (Object.values(config.config.mcpServers ?? {}).some((server) => server.enabled !== false)) {
			return yield* Effect.fail(
				failure("Disable configured MCP servers before using Work Fleet; tool permissions are not governed by the shell sandbox"),
			);
		}
		return codexConfiguration(request, checkout, metadata);
	});
}
