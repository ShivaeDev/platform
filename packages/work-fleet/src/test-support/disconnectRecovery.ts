import { Schema } from "effect";
import { codexServer } from "#test/codex.ts";
import { authFolder, cloudConfiguration, cloudThread, FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";
import { engine } from "#test/engineStory.ts";
import { reconnectingCodex } from "#test/reconnectingCodex.ts";

const TurnInput = Schema.Struct({ clientUserMessageId: Schema.String });

export function disconnectRecovery(delayedReads: number) {
	return engine.trait("configuration", "Codex disconnects after accepting the saved operation", function* (state) {
		state.now = 100;
		let missing = delayedReads;
		const submissions: string[] = [];
		const reads: string[] = [];
		const server = yield* codexServer((request) => {
			switch (request.method) {
				case "thread/read":
					return cloudThread();
				case "thread/start":
					return { thread: { id: "worker-thread" } };
				case "turn/start": {
					const input = Schema.decodeUnknownSync(TurnInput)(request.params);
					submissions.push(input.clientUserMessageId);
					throw new Error("Disconnect after accepting the turn");
				}
				case "thread/turns/list": {
					reads.push(request.method);
					if (missing > 0) {
						missing -= 1;
						return { data: [], nextCursor: null };
					}
					return {
						data: [{ id: "accepted-turn", items: [{ clientId: submissions[0], id: "input", type: "userMessage" }], status: "inProgress" }],
						nextCursor: null,
					};
				}
				default:
					return {};
			}
		});
		const authFile = yield* authFolder(syntheticToken("disconnect", FUTURE_EXPIRY));
		const configuration = cloudConfiguration(server.endpoint, authFile);
		state.recovery.disconnect = { reads, submissions };
		state.options = { ...state.options, decorateTransport: () => reconnectingCodex(server.endpoint, configuration) };
	});
}
