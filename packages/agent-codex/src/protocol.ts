import { Schema } from "effect";

export const PINNED_CLI_VERSION = "0.154.0-alpha.6.2";

export const InitializeResponse = Schema.Struct({ userAgent: Schema.String });

const ThreadRef = Schema.Struct({ id: Schema.String });

export const ThreadResponse = Schema.Struct({ thread: ThreadRef });

const ReasoningEffort = Schema.NonEmptyString;

export const TurnStatus = Schema.Literals(["completed", "interrupted", "failed", "inProgress"]);

export const TurnError = Schema.Struct({ message: Schema.String });

export const Turn = Schema.Struct({
	durationMs: Schema.optional(Schema.NullOr(Schema.Number)),
	error: Schema.optional(Schema.NullOr(TurnError)),
	id: Schema.String,
	status: TurnStatus,
});

export const TurnResponse = Schema.Struct({ turn: Turn });

export const ModelListResponse = Schema.Struct({
	data: Schema.Array(
		Schema.Struct({
			defaultReasoningEffort: ReasoningEffort,
			displayName: Schema.String,
			isDefault: Schema.Boolean,
			model: Schema.String,
			supportedReasoningEfforts: Schema.Array(Schema.Struct({ reasoningEffort: ReasoningEffort })),
		}),
	),
});

export const DynamicToolCallParams = Schema.Struct({
	arguments: Schema.Unknown,
	callId: Schema.String,
	threadId: Schema.String,
	tool: Schema.String,
});

export const ItemNotification = Schema.Struct({
	item: Schema.Unknown,
	threadId: Schema.String,
	turnId: Schema.String,
});

export const TurnNotification = Schema.Struct({
	threadId: Schema.String,
	turn: Turn,
});

const TokenBreakdown = Schema.Struct({
	cachedInputTokens: Schema.Number,
	cacheWriteInputTokens: Schema.optional(Schema.Number),
	inputTokens: Schema.Number,
	outputTokens: Schema.Number,
});

export const TokenUsageNotification = Schema.Struct({
	threadId: Schema.String,
	tokenUsage: Schema.Struct({ last: TokenBreakdown, total: TokenBreakdown }),
	turnId: Schema.String,
});

export const ModelReroutedNotification = Schema.Struct({
	fromModel: Schema.String,
	reason: Schema.String,
	threadId: Schema.String,
	toModel: Schema.String,
	turnId: Schema.String,
});

export const ThreadSettingsUpdatedNotification = Schema.Struct({
	threadId: Schema.String,
	threadSettings: Schema.Struct({ model: Schema.String }),
});

export const ThreadScoped = Schema.Struct({ threadId: Schema.String });

const SpawnSource = Schema.Struct({
	subAgent: Schema.Struct({
		threadSpawn: Schema.Struct({
			agentNickname: Schema.optional(Schema.NullOr(Schema.String)),
			agentPath: Schema.optional(Schema.NullOr(Schema.String)),
			agentRole: Schema.optional(Schema.NullOr(Schema.String)),
			parentThreadId: Schema.String,
		}).pipe(
			Schema.encodeKeys({ agentNickname: "agent_nickname", agentPath: "agent_path", agentRole: "agent_role", parentThreadId: "parent_thread_id" }),
		),
	}).pipe(Schema.encodeKeys({ threadSpawn: "thread_spawn" })),
});

export const SpawnedThread = Schema.Struct({
	thread: Schema.Struct({ id: Schema.String, source: SpawnSource }),
});

export const ThreadStatus = Schema.Union([
	Schema.Struct({
		activeFlags: Schema.Array(Schema.String),
		type: Schema.Literal("active"),
	}),
	Schema.Struct({ type: Schema.Literal("idle") }),
	Schema.Struct({ type: Schema.Literal("notLoaded") }),
	Schema.Struct({ type: Schema.Literal("systemError") }),
]);

export const ThreadListResponse = Schema.Struct({
	data: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			source: SpawnSource,
			status: ThreadStatus,
		}),
	),
	nextCursor: Schema.optional(Schema.NullOr(Schema.String)),
});

export const ThreadStatusNotification = Schema.Struct({
	status: ThreadStatus,
	threadId: Schema.String,
});
