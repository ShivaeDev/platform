import { Effect, FileSystem, Path, Schema } from "effect";
import { CONFIG_FILE, DEFAULT_NAMESPACE, NAMESPACE, SHARED_LOCAL_POSTGRES } from "#host/defaults.ts";

const Positive = Schema.Int.check(Schema.isGreaterThan(0));
const Text = Schema.String.check(Schema.isMinLength(1));

export const HostConfig = Schema.Struct({
	backlog: Schema.optional(Positive),
	cloud: Schema.optional(Schema.Struct({ cwd: Text, environmentId: Text })),
	concurrency: Schema.optional(Positive),
	database: Schema.optional(Schema.Struct({ maxConnections: Schema.optional(Positive), url: Schema.optional(Text) })),
	intervalSeconds: Schema.optional(Positive),
	launch: Schema.optional(Schema.Struct({ effort: Schema.optional(Text), model: Schema.optional(Text), serviceTier: Schema.optional(Text) })),
	local: Schema.optional(Schema.Struct({ endpoint: Text, requestTimeoutMs: Schema.optional(Positive) })),
	namespace: Schema.optional(Schema.String.check(Schema.isPattern(NAMESPACE))),
	provider: Schema.Literals(["local", "cloud"]),
	quota: Schema.optional(Schema.Literals(["codex", "unlimited"])),
	repository: Schema.optional(Schema.Struct({ branch: Text, remote: Text })),
});
export type HostConfig = typeof HostConfig.Type;

export class HostFailure extends Schema.TaggedError<HostFailure>()("HostFailure", { message: Schema.String }) {}

export interface FleetHost {
	readonly backlog: number;
	readonly boardDir: string;
	readonly cloud: HostConfig["cloud"];
	readonly concurrency: number;
	readonly databaseUrl: string;
	readonly interval: number;
	readonly launch: NonNullable<HostConfig["launch"]>;
	readonly local: HostConfig["local"];
	readonly maxConnections: number;
	readonly namespace: string;
	readonly provider: HostConfig["provider"];
	readonly quota: NonNullable<HostConfig["quota"]>;
	readonly repository: NonNullable<HostConfig["repository"]>;
}

export function resolveHost(boardDir: string, config: HostConfig): FleetHost {
	return {
		backlog: config.backlog ?? 100,
		boardDir,
		cloud: config.cloud,
		concurrency: config.concurrency ?? 100,
		databaseUrl: config.database?.url ?? SHARED_LOCAL_POSTGRES,
		interval: config.intervalSeconds ?? 15,
		launch: config.launch ?? {},
		local: config.local,
		maxConnections: config.database?.maxConnections ?? 20,
		namespace: config.namespace ?? DEFAULT_NAMESPACE,
		provider: config.provider,
		quota: config.quota ?? "codex",
		repository: config.repository ?? { branch: "main", remote: "origin" },
	};
}

export const loadHost = Effect.fn("FleetHost.loadHost")(function* (board: string, configPath?: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const boardDir = path.resolve(board);
	const file = configPath === undefined ? path.join(boardDir, CONFIG_FILE) : path.resolve(configPath);
	const text = yield* fs
		.readFileString(file)
		.pipe(Effect.mapError(() => new HostFailure({ message: `Fleet host configuration is missing or unreadable: ${file}` })));
	const config = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(HostConfig))(text).pipe(
		Effect.mapError((error) => new HostFailure({ message: `Fleet host configuration ${file} is invalid: ${error.message}` })),
	);
	return resolveHost(boardDir, config);
});
