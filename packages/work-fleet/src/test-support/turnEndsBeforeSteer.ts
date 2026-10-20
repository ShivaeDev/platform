import { Effect, Layer, Schema } from "effect";
import { codexConfiguration, codexServer, WireRejection } from "#test/codex.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

const SteerParams = Schema.Struct({ expectedTurnId: Schema.String });

export function turnEndsBeforeSteer(rejection = "NoActiveTurn") {
	return engineConfiguration("Codex completes the worker before replying to its steer", () =>
		Effect.gen(function* () {
			const turns = new Map<string, string>();
			let sessions = 0;
			const server = yield* codexServer((request) => {
				switch (request.method) {
					case "thread/start":
						sessions += 1;
						return { thread: { id: `session-${sessions}` } };
					case "turn/start": {
						const id = `turn-${turns.size + 1}`;
						turns.set(id, "inProgress");
						return { turn: { id } };
					}
					case "thread/turns/list":
						return {
							data: [...turns].map(([id, status]) => ({ id, items: [{ id: "work", type: "commandExecution" }], status })),
							nextCursor: null,
						};
					case "thread/items/list":
						return {
							data: [{ item: { id: "result", phase: "final_answer", text: "Completed the approved work", type: "agentMessage" } }],
							nextCursor: null,
						};
					case "turn/steer": {
						const { expectedTurnId } = Schema.decodeUnknownSync(SteerParams)(request.params);
						turns.set(expectedTurnId, "completed");
						return new WireRejection(`failed to steer turn: ${rejection}`);
					}
					default:
						return {};
				}
			});
			return { transportLayer: Layer.succeedContext(yield* Layer.build(codexConfiguration(server.endpoint))) };
		}),
	);
}
