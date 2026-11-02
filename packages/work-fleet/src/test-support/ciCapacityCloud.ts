import { Schema } from "effect";
import { WireRejection, type WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";

const Settings = Schema.Struct({ serviceTier: Schema.optional(Schema.String) });
const TurnInput = Schema.Struct({ clientUserMessageId: Schema.String, threadId: Schema.String });
const ThreadInput = Schema.Struct({ threadId: Schema.String });

export function ciCapacityCloud() {
	const requests: WireRequest[] = [];
	const turns: { sessionId: string; id: string; operationId: string; status: string }[] = [];
	let sessions = 0;
	function turnList(request: WireRequest) {
		const { threadId } = Schema.decodeUnknownSync(ThreadInput)(request.params);
		return {
			data: turns
				.filter((turn) => turn.sessionId === threadId)
				.map((turn) => ({
					id: turn.id,
					items: [{ clientId: turn.operationId, id: turn.operationId, type: "userMessage" }],
					status: turn.status,
				})),
			nextCursor: null,
		};
	}
	return {
		complete: () => {
			for (const turn of turns) {
				turn.status = "completed";
			}
		},
		handle: (request: WireRequest) => {
			requests.push(request);
			switch (request.method) {
				case "thread/start": {
					const { serviceTier } = Schema.decodeUnknownSync(Settings)(request.params);
					if (serviceTier === "default") {
						return new WireRejection("invalid service tier: default");
					}
					sessions += 1;
					return { ...(serviceTier === undefined ? {} : { serviceTier }), thread: { id: `session-${sessions}` } };
				}
				case "thread/read":
					return cloudThread();
				case "turn/start": {
					const input = Schema.decodeUnknownSync(TurnInput)(request.params);
					const id = `turn-${turns.length + 1}`;
					turns.push({ id, operationId: input.clientUserMessageId, sessionId: input.threadId, status: "inProgress" });
					return { turn: { id } };
				}
				case "thread/turns/list":
					return turnList(request);
				case "thread/items/list":
					return { data: [], nextCursor: null };
				default:
					return {};
			}
		},
		requests,
	};
}
