import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers, answerWork } from "#test/answerHost.ts";

const CLI_FAILURE = 1;
const CLI_SUCCESS = 0;
const RELEASE_RECEIPTS = 1;

answers.it("release confirms during a blocked launch and applies its accepted response once", [answerWork(["one", "two"])], function* (host) {
	yield* host.dispatch();
	const { decision } = yield* host.question();
	const admission = yield* host.holdAdmission();
	const launch = yield* host.dispatch("two").pipe(Effect.forkScoped);
	yield* admission.blocked;
	for (let request = 0; request < 2; request += 1) {
		expect(yield* host.cliRelease("one").pipe(Effect.timeout("5 seconds"))).toEqual({
			code: 0,
			stderr: "",
			stdout: `one needs-human: ${ANSWER_RECORDED}`,
		});
	}
	expect((yield* host.status()).waiting.automation).toMatchObject([{ blocker: ANSWER_RECORDED, workId: "one" }]);
	expect(yield* host.storedRequests()).toMatchObject([{ release: true, "work_id": "one" }]);
	yield* admission.release;
	yield* Fiber.join(launch);
	const released = yield* host.applied();
	expect(released.stage).toBe("released");
	expect(released.responses?.filter((response) => response.decisionId === decision.id)).toMatchObject([
		{ action: "release", boardAcknowledged: true },
	]);
	expect(host.boardReceipts()).toHaveLength(RELEASE_RECEIPTS);
	expect(yield* host.cliRelease("one")).toEqual({ code: 0, stderr: "", stdout: "one released" });
	expect((yield* host.get()).responses).toEqual(released.responses);
	expect(host.boardReceipts()).toHaveLength(RELEASE_RECEIPTS);
});

answers.it("release reports refusal for running work or an unrecorded request", [], function* (host) {
	yield* host.dispatch();
	expect((yield* host.cliRelease("one")).code).toBe(CLI_FAILURE);
	yield* host.question();
	yield* host.failRecording(true);
	expect((yield* host.cliRelease("one")).code).toBe(CLI_FAILURE);
	expect(yield* host.storedRequests()).toEqual([]);
	expect(host.boardReceipts()).toEqual([]);
	yield* host.failRecording(false);
	expect((yield* host.cliRelease("one")).code).toBe(CLI_SUCCESS);
	expect((yield* host.applied()).stage).toBe("released");
});
