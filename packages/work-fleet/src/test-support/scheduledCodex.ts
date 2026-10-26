import { Clock, Context, Effect, Layer } from "effect";
import { SessionTransport } from "#session/service.ts";
import { codexServer } from "#test/codex.ts";
import { authFolder, cloudConfiguration, FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";
import { REPORT } from "#test/githubResult.ts";

export const scheduledCodex = Effect.fn("Test.scheduledCodex")(function* (silent: boolean) {
	const clock = yield* Clock.Clock;
	const reads: number[] = [];
	const server = yield* codexServer((request) => {
		switch (request.method) {
			case "thread/turns/list":
				reads.push(clock.currentTimeMillisUnsafe());
				return silent || reads.length === 1 ? undefined : { data: [{ id: "turn-operation-1", items: [], status: "completed" }], nextCursor: null };
			case "thread/items/list":
				return { data: [{ item: { id: "output", phase: "final_answer", text: REPORT, type: "agentMessage" } }], nextCursor: null };
			default:
				return {};
		}
	});
	const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
	const services = yield* Layer.build(cloudConfiguration(server.endpoint, authFile, { requestTimeoutMs: 1000 })).pipe(Effect.orDie);
	const transport = Context.get(services, SessionTransport);
	return { reads, transport };
});
