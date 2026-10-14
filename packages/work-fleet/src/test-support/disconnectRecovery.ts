import { expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { codexServer } from "#test/codex.ts";
import { authFolder, cloudConfiguration, cloudThread, FUTURE_EXPIRY, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { reconnectingCodex } from "#test/reconnectingCodex.ts";

const TurnInput = Schema.Struct({ clientUserMessageId: Schema.String });

export const disconnectRecovery = Effect.fn("Test.disconnectRecovery")(function* (delayedReads: number) {
	let now = 100;
	let missing = delayedReads;
	const submissions: string[] = [];
	const reads: string[] = [];
	const server = yield* codexServer((request) => {
		if (request.method === "thread/read") {
			return cloudThread();
		}
		if (request.method === "thread/start") {
			return { thread: { id: "worker-thread" } };
		}
		if (request.method === "turn/start") {
			const input = Schema.decodeUnknownSync(TurnInput)(request.params);
			submissions.push(input.clientUserMessageId);
			throw new Error("Disconnect after accepting the turn");
		}
		if (request.method === "thread/turns/list") {
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
		return {};
	});
	const authFile = yield* authFolder(syntheticToken("disconnect", FUTURE_EXPIRY));
	const configuration = cloudConfiguration(server.endpoint, authFile);
	return yield* withEngine({ decorateTransport: () => reconnectingCodex(server.endpoint, configuration), now: () => now }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const prepared = yield* prepareWork("one");
			yield* fixture.replaceRecord({ ...prepared.value, cwd: SYNTHETIC_WORKSPACE });
			const waiting = (yield* fleet.dispatch("one")).value;
			expect(waiting.stage).toBe("executing");
			expect(waiting.decision).toBeUndefined();
			expect(waiting.attentionOwner).toBe("automation");
			expect(waiting.blocker).toContain("Codex disconnected");
			expect(waiting.attempts).toHaveLength(1);
			const operationId = waiting.attempts[0]?.operationId;
			expect(waiting.attempts[0]).toMatchObject({
				readRetry: { failures: 1, retryAt: 30_100 },
				sessionId: "worker-thread",
				status: "submitting",
				submissionUncertain: true,
			});
			expect(waiting.attempts[0]?.receipt).toBeUndefined();
			now = 30_099;
			yield* fixture.restart(cycle);
			expect(reads).toHaveLength(0);
			now = 30_100;
			yield* fixture.restart(cycle);
			for (let failedRead = 1; failedRead <= delayedReads; failedRead += 1) {
				const retrying = (yield* fleet.get("one")).value;
				if (failedRead === 4) {
					expect(retrying.stage).toBe("needs-human");
					expect(retrying.decision?.reason).toContain("read failure after 5 attempts");
					expect(retrying.decisionPublished).toBe(true);
					expect(fixture.decisions).toHaveLength(1);
					yield* fixture.restart(cycle);
					expect((yield* fleet.get("one")).value.decision).toEqual(retrying.decision);
					expect(fixture.decisions).toHaveLength(1);
					expect(submissions).toEqual([operationId]);
					return;
				}
				expect(retrying.decision).toBeUndefined();
				expect(retrying.attempts[0]?.readRetry?.failures).toBe(failedRead + 1);
				now = retrying.attempts[0]?.readRetry?.retryAt ?? 0;
				yield* fixture.restart(cycle);
			}
			const recovered = (yield* fleet.get("one")).value;
			expect(recovered.decision).toBeUndefined();
			expect(recovered.stage).toBe("executing");
			expect(recovered.blocker).toBeUndefined();
			expect(recovered.attentionOwner).toBeUndefined();
			expect(recovered.attempts).toHaveLength(1);
			expect(recovered.attempts[0]).toMatchObject({
				operationId,
				receipt: { sessionId: "worker-thread", turnId: "accepted-turn" },
				status: "running",
			});
			expect(recovered.attempts[0]?.readRetry).toBeUndefined();
			yield* fixture.restart(cycle);
			expect(submissions).toEqual([operationId]);
			expect(fixture.decisions).toHaveLength(0);
		}),
	);
}, Effect.scoped);
