import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { connect, request } from "#providers/codexRpc.ts";
import { SessionFailure } from "#session/schema.ts";
import { codexServer, WireRejection } from "#test/codex.ts";
import { prepareWork, withEngine } from "#test/engine.ts";

export const queueRecovery = Effect.fn("Test.queueRecovery")(function* (call: "session" | "turn") {
	const wire = yield* codexServer(() => new WireRejection("No execution slots are available.", undefined, -32_001));
	const connection = yield* connect({ url: new URL(wire.endpoint) }, 1000);
	const rejected = yield* request(connection, 1000, "turn/start", {}, true).pipe(Effect.flip);
	expect(rejected.code).toBe("session-queue-full");
	const reworded = new SessionFailure({ ...rejected, message: "Please wait until the provider has room for another operation." });
	let now = 100;
	let reject = true;
	return yield* withEngine(
		{ now: () => now, submissionFailure: (rejectedCall) => (reject && rejectedCall === call ? reworded : undefined) },
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* cycle;
				const queued = (yield* fleet.get("one")).value;
				expect(queued).toMatchObject({
					attentionOwner: "automation",
					launchRetry: { rejectedAt: 100, rejections: 1, retryAt: 30_100 },
					stage: "prepared",
				});
				expect(queued.attempts[0]).toMatchObject({ output: reworded.message, status: "failed" });
				expect(queued.decision).toBeUndefined();
				reject = false;
				now = 30_099;
				yield* fixture.restart(cycle);
				expect((yield* fleet.get("one")).value.launchRetry).toEqual(queued.launchRetry);
				expect(fixture.launched).toHaveLength(1);
				now = 30_100;
				yield* fixture.restart(cycle);
				const accepted = (yield* fleet.get("one")).value;
				expect(accepted.stage).toBe("executing");
				expect(accepted.launchRetry).toBeUndefined();
				expect(accepted.attempts.at(-1)?.receipt).toBeDefined();
				expect(fixture.launched).toHaveLength(call === "turn" ? 1 : 2);
				if (call === "turn") {
					expect(accepted.attempts.at(-1)?.receipt?.sessionId).toBe(queued.attempts[0]?.sessionId);
				}
				expect(fixture.decisions).toEqual([]);
			}),
	);
}, Effect.scoped);
