import { Clock } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

for (const tcp of [true, false]) {
	boardStory.it(
		`ends an open ${tcp ? "TCP" : "socket"} subscription when draining starts`,
		[deferredServing, projectFiles({ "home.md": "# Home" })],
		function* (board) {
			yield* board.start({ drainRequests: true });
			const connection = yield* board.openShutdownConnection(true, tcp);
			const started = yield* Clock.currentTimeMillis;
			yield* board.stop();
			const closed = yield* connection.closed;
			expect(closed.at - started).toBeLessThan(3000);
			expect(closed.body).toContain('"_tag":"Chunk"');
			expect(closed.body).toContain('"_tag":"Success"');
			expect(board.socketState()).toBeUndefined();
		},
	);

	boardStory.it(`cuts an unfinished ${tcp ? "TCP" : "socket"} request after the drain deadline`, [deferredServing], function* (board) {
		yield* board.start({ drainRequests: true });
		const connection = yield* board.openShutdownConnection(false, tcp);
		const started = yield* Clock.currentTimeMillis;
		yield* board.stop();
		expect((yield* Clock.currentTimeMillis) - started).toBeGreaterThanOrEqual(4900);
		expect([0, 503]).toContain((yield* connection.closed).status);
		expect(board.socketState()).toBeUndefined();
	});
}
