import { Effect, Redacted, Schema } from "effect";
import { type CodexLogin, codexCredentials } from "#providers/codexLogin.ts";
import { failure } from "#providers/codexRpc.ts";
import type { SessionReceipt } from "#session/schema.ts";

const Turn = Schema.Struct({
	id: Schema.String,
	outputItems: Schema.optional(
		Schema.NullOr(
			Schema.Array(
				Schema.Struct({
					diff: Schema.optional(Schema.NullOr(Schema.String)),
					outputDiff: Schema.optional(Schema.NullOr(Schema.Struct({ diff: Schema.optional(Schema.NullOr(Schema.String)) }))),
					type: Schema.String,
				}).pipe(Schema.encodeKeys({ outputDiff: "output_diff" })),
			),
		),
	),
}).pipe(Schema.encodeKeys({ outputItems: "output_items" }));
const Task = Schema.Struct({ currentAssistantTurn: Turn, currentDiffTaskTurn: Schema.optional(Schema.NullOr(Turn)) }).pipe(
	Schema.encodeKeys({ currentAssistantTurn: "current_assistant_turn", currentDiffTaskTurn: "current_diff_task_turn" }),
);

export function makeCodexTaskDiff<R, E>(read: (path: string) => Effect.Effect<unknown, E, R>) {
	return Effect.fn("CodexCloud.taskDiff")(
		function* (receipt: SessionReceipt) {
			const task = yield* read(`wham/tasks/${encodeURIComponent(receipt.sessionId)}`).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Task)));
			if (task.currentAssistantTurn.id !== receipt.turnId) {
				return yield* Effect.fail(failure("protocol", "Cloud task output belongs to a different turn"));
			}
			const turn = task.currentDiffTaskTurn ?? task.currentAssistantTurn;
			if (turn.id !== receipt.turnId) {
				return yield* Effect.fail(failure("protocol", "Cloud task diff belongs to a different turn"));
			}
			const diffs = (turn.outputItems ?? [])
				.filter((item) => item.type === "output_diff" || item.type === "pr")
				.map((item) => item.diff ?? item.outputDiff?.diff ?? "");
			return diffs.join("\n");
		},
		Effect.mapError(() => failure("unavailable", "Cloud task attachments are unavailable or do not match the completed turn")),
	);
}

export function codexTaskDiff(login: CodexLogin, timeoutMs: number, endpoint = "https://chatgpt.com/backend-api/") {
	return makeCodexTaskDiff((path) =>
		Effect.gen(function* () {
			const credentials = yield* codexCredentials(login, timeoutMs);
			return yield* Effect.tryPromise({
				catch: () => failure("unavailable", "Cloud task download failed"),
				try: async (signal) => {
					const response = await fetch(new URL(path, endpoint), {
						headers: {
							Authorization: `Bearer ${Redacted.value(credentials.token)}`,
							"User-Agent": "work-fleet",
							...(credentials.accountId === undefined ? {} : { "ChatGPT-Account-Id": credentials.accountId }),
						},
						redirect: "error",
						signal,
					});
					if (!response.ok) {
						throw new Error("Cloud task download failed");
					}
					return response.json();
				},
			}).pipe(Effect.timeout(`${timeoutMs} millis`));
		}),
	);
}
