import { Clock } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

for (const tcp of [true, false]) {
	boardStory.it(
		`ends a ${tcp ? "TCP" : "socket"} subscription at shutdown and cuts an unfinished request after draining`,
		[deferredServing, projectFiles({ "home.md": "# Home" })],
		function* (board) {
			yield* board.start({ drainRequests: true });
			const subscription = yield* board.openShutdownConnection(true, tcp);
			const unfinished = yield* board.openShutdownConnection(false, tcp);
			const started = yield* Clock.currentTimeMillis;
			yield* board.stop();
			const closed = yield* subscription.closed;
			expect(closed.at - started).toBeLessThan(3000);
			expect(closed.body).toContain('"_tag":"Chunk"');
			expect(closed.body).toContain('"_tag":"Success"');
			expect((yield* Clock.currentTimeMillis) - started).toBeGreaterThanOrEqual(4900);
			expect([0, 503]).toContain((yield* unfinished.closed).status);
			expect(board.socketState()).toBeUndefined();
		},
	);
}
