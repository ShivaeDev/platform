import { Clock } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

for (const tcp of [true, false]) {
	boardStory.it(
		`cuts an unfinished ${tcp ? "TCP" : "socket"} request after draining and unpublishes the socket`,
		[deferredServing, projectFiles({ "home.md": "# Home" })],
		function* (board) {
			yield* board.start({ drainRequests: true });
			const unfinished = yield* board.openShutdownConnection(tcp);
			const started = yield* Clock.currentTimeMillis;
			yield* board.stop();
			expect((yield* Clock.currentTimeMillis) - started).toBeGreaterThanOrEqual(4900);
			expect([0, HttpStatus.fromLiteral("ServiceUnavailable")]).toContain((yield* unfinished.closed).status);
			expect(board.socketState()).toBeUndefined();
		},
	);
}
