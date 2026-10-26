import { Effect, Schema } from "effect";
import { codexServer, type WireRequest } from "#test/codex.ts";

const TurnParams = Schema.Struct({ threadId: Schema.String, turnId: Schema.String });

export const stalledCodex = Effect.fn("Test.stalledCodex")(function* (delayInterrupt = false) {
	const requests: WireRequest[] = [];
	const states = new Map<string, string>();
	const hidden = new Set<string>();
	let turns = 0;
	let threads = 0;
	let items = [{ id: "command", status: "inProgress", type: "commandExecution" }];
	const server = yield* codexServer((request) => {
		requests.push(request);
		switch (request.method) {
			case "thread/start":
				threads += 1;
				return { thread: { id: threads === 1 ? "worker-thread" : "reviewer-thread" } };
			case "turn/start": {
				turns += 1;
				const id = `turn-${turns}`;
				states.set(id, "inProgress");
				return { turn: { id } };
			}
			case "thread/turns/list":
				return { data: [...states].filter(([id]) => !hidden.has(id)).map(([id, status]) => ({ id, items: [], status })), nextCursor: null };
			case "thread/items/list":
				return { data: items.toReversed().map((item) => ({ item })), nextCursor: null };
			case "turn/interrupt": {
				const params = Schema.decodeUnknownSync(TurnParams)(request.params);
				if (!delayInterrupt) {
					states.set(params.turnId, "interrupted");
				}
				return {};
			}
			default:
				return {};
		}
	});
	return {
		...server,
		addItem: () => {
			items = [...items, { id: `command-${items.length}`, status: "inProgress", type: "commandExecution" }];
		},
		changeStatus: () => {
			items = items.map((item) => ({ ...item, status: item.status === "inProgress" ? "completed" : "inProgress" }));
		},
		hidden,
		requests,
		states,
	};
});
