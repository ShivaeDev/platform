import { expect } from "@effect/vitest";
import { controlPublication } from "#test/controlPublication.ts";

controlPublication.it("release confirms a recorded response while provider cleanup is blocked", [], function* (daemon) {
	const started = yield* daemon.dispatch();
	yield* daemon.question();
	yield* daemon.blockCleanup();
	expect(yield* daemon.release()).toMatchObject([{ blocker: "Answer recorded; applying in the background", workId: "one" }]);
	yield* daemon.awaitCleanup();
	expect(daemon.archived()).toHaveLength(0);
	yield* daemon.releaseCleanup();
	expect((yield* daemon.waitReleased()).responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
	expect(daemon.archived()).toEqual([started.attempts[0]?.receipt?.sessionId]);
});
