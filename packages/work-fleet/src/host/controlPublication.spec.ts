import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { controlPublication } from "#test/controlPublication.ts";

const MESSAGE = "Use PostgreSQL and keep the existing PR.";

controlPublication.it("continue confirms and applies once while another launch's Board publication is blocked", [], function* (daemon) {
	const original = yield* daemon.dispatch();
	yield* daemon.question();
	yield* daemon.prepareLaunch();
	yield* daemon.blockLaunchPublication();
	const continued = yield* daemon.continue(MESSAGE);
	expect(continued.step).toBe("working");
	expect(continued.attempts).toHaveLength(1);
	expect(continued.attempts[0]).toMatchObject({ prompt: MESSAGE, receipt: { sessionId: original.attempts[0]?.receipt?.sessionId } });
	expect(daemon.turns()).toHaveLength(3);
	yield* daemon.releasePublication();
	yield* daemon.flush();
	expect(daemon.status()).toContain("Stage: working");
	expect((yield* daemon.get()).attempts).toEqual(continued.attempts);
});

controlPublication.it("repeating continue after a lost acknowledgement reports a definite refusal and applies once", [], function* (daemon) {
	yield* daemon.dispatch();
	yield* daemon.question();
	yield* daemon.prepareLaunch();
	yield* daemon.blockLaunchPublication();
	yield* daemon.loseAcknowledgement(MESSAGE);
	const recorded = yield* daemon.get();
	expect(recorded.attempts).toHaveLength(1);
	expect(recorded.attempts[0]?.prompt).toBe(MESSAGE);
	const repeated = yield* daemon.continue(MESSAGE).pipe(Effect.result);
	expect(repeated).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
	yield* daemon.releasePublication();
	yield* daemon.flush();
	expect((yield* daemon.get()).attempts).toEqual(recorded.attempts);
	expect(daemon.turns()).toHaveLength(3);
});

for (const command of ["answer", "release"] as const) {
	controlPublication.it(`${command} confirms its recorded change without waiting for launch publication`, [], function* (daemon) {
		yield* daemon.dispatch();
		yield* daemon.question();
		yield* daemon.prepareLaunch();
		yield* daemon.blockLaunchPublication();
		const result = yield* command === "answer" ? daemon.answer().pipe(Effect.map((record) => [record])) : daemon.release();
		expect(result[0]).toMatchObject({ workId: "one" });
		yield* daemon.releasePublication();
		yield* daemon.flush();
	});
}

controlPublication.it("release confirms a recorded response while provider cleanup is blocked", [], function* (daemon) {
	yield* daemon.dispatch();
	yield* daemon.question();
	yield* daemon.blockCleanup();
	expect(yield* daemon.release()).toMatchObject([{ blocker: "Answer recorded; applying in the background", workId: "one" }]);
	yield* daemon.awaitCleanup();
	expect(daemon.archived()).toHaveLength(0);
	yield* daemon.releaseCleanup();
	expect((yield* daemon.waitReleased()).responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
	expect(daemon.archived()).toHaveLength(1);
});

controlPublication.it("host shutdown flushes the recorded state after cancelling pending publication", [], function* (daemon) {
	yield* daemon.dispatch();
	yield* daemon.question();
	yield* daemon.prepareLaunch();
	yield* daemon.blockLaunchPublication();
	yield* daemon.continue(MESSAGE);
	yield* daemon.releasePublication();
	yield* daemon.stop();
	const card = daemon.status().split("### one\n")[1]?.split("\n### ")[0]?.split("\n## ")[0];
	expect(card).toContain("Stage: working");
});
