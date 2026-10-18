import * as Schema from "effect/Schema";
import { DEFAULT_READ_RETRY_MS } from "#engine/readRetry.ts";
import { DEFAULT_NAMESPACE, NAMESPACE, SHARED_LOCAL_POSTGRES } from "#host/defaults.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS } from "#scheduling/areas.ts";
import { LaunchSettings } from "#session/schema.ts";
import type { OpenPullRequestCurve } from "#storage/model.ts";

const Positive = Schema.Int.check(Schema.isGreaterThan(0));
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Text = Schema.String.check(Schema.isMinLength(1));
const Guidance = Schema.Union([Text, Schema.Struct({ file: Text })]);

export const HostConfig = Schema.Struct({
	areaMergeWaitMs: Schema.optional(Positive),
	backlog: Schema.optional(Positive),
	cloud: Schema.optional(
		Schema.Struct({
			archiveThreads: Schema.optional(Schema.Boolean),
			authFile: Schema.optional(Text),
			cwd: Text,
			endpoint: Schema.optional(Text),
			environmentId: Text,
			projectId: Schema.optional(Text),
			recoveryGraceMs: Schema.optional(Positive),
			refreshCommand: Schema.optional(Schema.Struct({ args: Schema.Array(Schema.String), command: Text })),
			requestTimeoutMs: Schema.optional(Positive),
			threadNamePrefix: Schema.optional(Text),
			writableRoots: Schema.optional(Schema.Array(Text)),
		}),
	),
	concurrency: Schema.optional(Positive),
	database: Schema.optional(Schema.Struct({ maxConnections: Schema.optional(Positive), url: Schema.optional(Text) })),
	intervalSeconds: Schema.optional(Positive),
	launch: Schema.optional(LaunchSettings),
	local: Schema.optional(Schema.Struct({ endpoint: Text, requestTimeoutMs: Schema.optional(Positive) })),
	namespace: Schema.optional(Schema.String.check(Schema.isPattern(NAMESPACE))),
	openPullRequests: Schema.optional(
		Schema.Struct({ ease: Count, floor: Schema.optional(Count), max: Positive }).check(
			Schema.makeFilter((curve) => curve.ease <= curve.max || "openPullRequests.ease must not exceed openPullRequests.max"),
		),
	),
	provider: Schema.Literals(["local", "cloud"]),
	quota: Schema.optional(Schema.Literals(["codex", "unlimited"])),
	readRetryMs: Schema.optional(Positive),
	repository: Schema.optional(Schema.Struct({ branch: Text, remote: Text })),
	result: Schema.optional(Schema.Literal("github")),
	stallMinutes: Schema.optional(Positive),
	worker: Schema.optional(
		Schema.Struct({
			branchPrefix: Text,
			reviewerGuidance: Schema.optional(Guidance),
			sharedEnvironment: Text,
			workerGuidance: Schema.optional(Guidance),
		}),
	),
});
export type HostConfig = typeof HostConfig.Type;

export class HostFailure extends Schema.TaggedError<HostFailure>()("HostFailure", { message: Schema.String }) {}

export class HostConfigRejected extends Schema.TaggedError<HostConfigRejected>()("HostConfigRejected", {
	field: Schema.optional(Schema.String),
	file: Schema.String,
	message: Schema.String,
}) {}

export interface FleetHost {
	readonly areaMergeWaitMs: number;
	readonly backlog: number;
	readonly boardDir: string;
	readonly cloud: HostConfig["cloud"];
	readonly concurrency: number;
	readonly config: HostConfig;
	readonly configFile?: string;
	readonly databaseUrl: string;
	readonly interval: number;
	readonly launch: NonNullable<HostConfig["launch"]>;
	readonly local: HostConfig["local"];
	readonly maxConnections: number;
	readonly namespace: string;
	readonly openPullRequests?: OpenPullRequestCurve;
	readonly provider: HostConfig["provider"];
	readonly quota: NonNullable<HostConfig["quota"]>;
	readonly readRetryMs: number;
	readonly repository: NonNullable<HostConfig["repository"]>;
	readonly result?: HostConfig["result"];
	readonly stallMinutes: number;
	readonly worker: HostConfig["worker"];
}

export function resolveHost(boardDir: string, config: HostConfig, configFile?: string): FleetHost {
	return {
		areaMergeWaitMs: config.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS,
		backlog: config.backlog ?? 100,
		boardDir,
		cloud: config.cloud,
		concurrency: config.concurrency ?? 100,
		config,
		...(configFile === undefined ? {} : { configFile }),
		databaseUrl: config.database?.url ?? SHARED_LOCAL_POSTGRES,
		interval: config.intervalSeconds ?? 15,
		launch: config.launch ?? {},
		local: config.local,
		maxConnections: config.database?.maxConnections ?? 20,
		namespace: config.namespace ?? DEFAULT_NAMESPACE,
		...(config.openPullRequests === undefined ? {} : { openPullRequests: { ...config.openPullRequests, floor: config.openPullRequests.floor ?? 0 } }),
		provider: config.provider,
		quota: config.quota ?? "codex",
		readRetryMs: config.readRetryMs ?? DEFAULT_READ_RETRY_MS,
		repository: config.repository ?? { branch: "main", remote: "origin" },
		result: config.result,
		stallMinutes: config.stallMinutes ?? 30,
		worker: config.worker,
	};
}
