import { Effect, Layer, Schema } from "effect";
import type { SessionReceipt } from "#session/schema.ts";
import { codexConfiguration, codexServer } from "#test/codex.ts";
import { engine } from "#test/engineStory.ts";
import { reviewerObservation } from "#test/reviewerObservation.ts";

const Thread = Schema.Struct({ threadId: Schema.String });
const StartTurn = Schema.Struct({ input: Schema.Array(Schema.Struct({ text: Schema.String })), threadId: Schema.String });

export const schedulerProvider = engine.trait("configuration", "Codex replies over a loopback socket", function* (state) {
	const turns = new Map<string, { receipt: SessionReceipt; status: string; output: string }>();
	let threads = 0;
	let held: { sessionId: string; entered: () => void; release: Promise<void> } | undefined;
	const server = yield* codexServer(async (request) => {
		switch (request.method) {
			case "thread/start":
				threads += 1;
				return { thread: { id: `thread-${threads}` } };
			case "turn/start": {
				const input = Schema.decodeUnknownSync(StartTurn)(request.params);
				const receipt = { sessionId: input.threadId, turnId: `turn-${turns.size + 1}` };
				const prompt = input.input.map(({ text }) => text).join("\n");
				const review = prompt.includes("Review target: ");
				turns.set(receipt.turnId, {
					output: review ? reviewerObservation({}, prompt, receipt, []).output : "",
					receipt,
					status: review ? "completed" : "inProgress",
				});
				return { turn: { id: receipt.turnId } };
			}
			case "thread/turns/list": {
				const { threadId } = Schema.decodeUnknownSync(Thread)(request.params);
				const gate = held;
				if (gate?.sessionId === threadId) {
					held = undefined;
					gate.entered();
					await gate.release;
				}
				return {
					data: [...turns.values()]
						.filter(({ receipt }) => receipt.sessionId === threadId)
						.map(({ receipt, status }) => ({ id: receipt.turnId, items: [], status })),
					nextCursor: null,
				};
			}
			case "thread/items/list": {
				const { threadId } = Schema.decodeUnknownSync(Thread)(request.params);
				const latest = [...turns.values()].findLast(({ receipt }) => receipt.sessionId === threadId);
				return { data: latest?.output ? [{ item: { id: "answer", text: latest.output, type: "agentMessage" } }] : [], nextCursor: null };
			}
			default:
				return {};
		}
	});
	state.schedulerProvider = {
		finish: (receipt) => {
			const turn = turns.get(receipt.turnId);
			if (turn === undefined) {
				throw new Error(`No provider turn ${receipt.turnId}`);
			}
			turn.status = "completed";
		},
		hold: (sessionId) => {
			const entered = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();
			held = { entered: entered.resolve, release: release.promise, sessionId };
			return { entered: Effect.promise(() => entered.promise), release: Effect.sync(() => release.resolve()) };
		},
	};
	state.options = { ...state.options, transportLayer: codexConfiguration(server.endpoint, 10_000).pipe(Layer.orDie) };
});
