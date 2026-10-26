import { Schema } from "effect";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";

const TurnParams = Schema.Struct({ clientUserMessageId: Schema.String, threadId: Schema.String });
const ThreadParams = Schema.Struct({ threadId: Schema.String });
export function cloudFanout() {
	const sessions: string[] = [];
	const operations = new Map<string, string>();
	const mutations: string[] = [];
	return {
		handle(request: WireRequest) {
			switch (request.method) {
				case "thread/start": {
					const id = `synthetic-session-${sessions.length}`;
					sessions.push(id);
					mutations.push(request.method);
					return { thread: { id } };
				}
				case "thread/read":
					return cloudThread();
				case "turn/start": {
					const input = Schema.decodeUnknownSync(TurnParams)(request.params);
					operations.set(input.threadId, input.clientUserMessageId);
					mutations.push(request.method);
					return undefined;
				}
				case "thread/turns/list": {
					const { threadId } = Schema.decodeUnknownSync(ThreadParams)(request.params);
					return {
						data: [
							{ id: `turn-${threadId}`, items: [{ clientId: operations.get(threadId), id: "input", type: "userMessage" }], status: "inProgress" },
						],
						nextCursor: null,
					};
				}
				case "thread/items/list":
					return { data: [], nextCursor: null };
				default:
					return {};
			}
		},
		mutations,
		operations,
		sessions,
	};
}
